import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { desc, eq, inArray } from "drizzle-orm";
import { config } from "../../config.js";
import type { Db } from "../../infra/db/client.js";
import { firmwareBuilds } from "../../infra/db/schema.js";
import { runBuild } from "../../infra/firmware/buildRunner.js";
import { gzipBuffer } from "../../infra/firmware/compress.js";
import { downloadPrebuiltAsset, listPrebuiltAssets } from "../../infra/firmware/prebuilt.js";
import { getFirmwareVersion, startPullOta } from "../../infra/tasmota/client.js";
import type { Broadcaster } from "../broadcaster.js";
import type { DeviceService } from "../devices/service.js";
import { ConfigurationError, NotFoundError, OtaVerificationError } from "../errors.js";

// A successful OTA flash reboots the device, so we can't trust the upload
// response — we wait for it to come back up and confirm the firmware
// version actually changed. Bounded so an unreachable/bricked device fails
// loudly instead of polling forever.
const OTA_VERIFY_INITIAL_DELAY_MS = 10_000;
const OTA_VERIFY_POLL_INTERVAL_MS = 5_000;
const OTA_VERIFY_MAX_ATTEMPTS = 12;

export interface CreateBuildInput {
  baseVersion: string;
  env: string;
  overrides: string;
  buildFlags: string;
  presetName?: string;
}

/**
 * Persisted FIFO build queue. Builds survive a server restart in the DB
 * (any left "queued"/"building" when the process starts are marked failed —
 * there's no way to resume a half-finished PlatformIO invocation safely).
 * One build runs at a time to keep resource usage predictable on a
 * self-hosted box; logs are appended to a plain file per build and streamed
 * to clients over WS as they're produced.
 */
export class BuildQueue {
  private processing = false;
  private readonly logDir = path.join(config.firmwareOutputDir, "logs");

  constructor(
    private readonly db: Db,
    private readonly deviceService: DeviceService,
    private readonly broadcaster?: Broadcaster,
  ) {}

  async init() {
    await mkdir(config.firmwareOutputDir, { recursive: true });
    await mkdir(this.logDir, { recursive: true });

    this.db
      .update(firmwareBuilds)
      .set({
        status: "failed",
        errorMessage: "Interrupted by server restart",
        completedAt: new Date().toISOString(),
      })
      .where(inArray(firmwareBuilds.status, ["queued", "building"]))
      .run();
  }

  enqueue(input: CreateBuildInput) {
    const build = this.db.insert(firmwareBuilds).values(input).returning().get();
    void this.processQueue();
    return build;
  }

  listPrebuiltVariants(version: string) {
    return listPrebuiltAssets(version);
  }

  /**
   * Downloads an official prebuilt binary instead of compiling one. The
   * resulting row lives in the same firmware_builds table as a compiled
   * build (status "success" immediately, source "prebuilt"), so it's
   * listed/downloaded/pushed-to-device through the exact same paths.
   */
  async downloadPrebuilt(baseVersion: string, env: string) {
    const { data, filename } = await downloadPrebuiltAsset(baseVersion, env);
    const storedFilename = `prebuilt-${Date.now()}-${filename}`;
    await writeFile(path.join(config.firmwareOutputDir, storedFilename), data);

    const gzFilename = `${storedFilename}.gz`;
    await writeFile(path.join(config.firmwareOutputDir, gzFilename), await gzipBuffer(data));

    const build = this.db
      .insert(firmwareBuilds)
      .values({
        baseVersion,
        env,
        overrides: "",
        buildFlags: "",
        source: "prebuilt",
        status: "success",
        binaryFilename: storedFilename,
        binaryGzFilename: gzFilename,
        completedAt: new Date().toISOString(),
      })
      .returning()
      .get();

    this.broadcaster?.broadcast({
      type: "build.status",
      payload: { buildId: build.id, status: "success" },
    });

    return build;
  }

  list() {
    return this.db.select().from(firmwareBuilds).orderBy(desc(firmwareBuilds.id)).all();
  }

  getById(id: number) {
    const build = this.db.select().from(firmwareBuilds).where(eq(firmwareBuilds.id, id)).get();
    if (!build) throw new NotFoundError("Firmware build", id);
    return build;
  }

  async getLog(id: number): Promise<string> {
    this.getById(id);
    try {
      return await readFile(this.logPath(id), "utf8");
    } catch {
      return "";
    }
  }

  getBinaryPath(id: number, { compressed = false }: { compressed?: boolean } = {}): string {
    const build = this.getById(id);
    const filename = compressed ? build.binaryGzFilename : build.binaryFilename;
    if (!filename) {
      throw new NotFoundError(
        compressed ? "Compressed firmware binary for build" : "Firmware binary for build",
        id,
      );
    }
    return path.join(config.firmwareOutputDir, filename);
  }

  /**
   * Pushes a build to a device via pull-based OTA (points the device's
   * OtaUrl at our own download endpoint and issues Upgrade), then verifies
   * the flash actually succeeded by polling for a firmware version change
   * rather than trusting the Upgrade command's HTTP response — Tasmota
   * reboots as part of a successful OTA, so a dropped connection there is
   * expected and not itself a failure signal.
   */
  async pushToDevice(
    buildId: number,
    deviceId: number,
    { compressed = false, onProgress }: { compressed?: boolean; onProgress?: (status: "verifying") => void } = {},
  ) {
    this.getById(buildId);
    this.getBinaryPath(buildId, { compressed }); // throws if that variant doesn't exist on disk
    const device = this.deviceService.getById(deviceId);
    const previousVersion = device.firmwareVersion;

    if (!config.otaUrlDomain) {
      throw new ConfigurationError(
        "OTA_URL_DOMAIN is not configured — set it to the IP or domain devices can use to reach this " +
          "server (e.g. 192.168.1.50:3000) so they can pull firmware from it.",
      );
    }

    const firmwareUrl = `http://${config.otaUrlDomain}/api/firmware/builds/${buildId}/download${
      compressed ? "?compressed=true" : ""
    }`;

    try {
      await startPullOta(device.host, firmwareUrl);
    } catch {
      // Best-effort: a dropped connection here can just mean the device
      // rebooted mid-response. Fall through to verification instead of
      // failing immediately.
    }

    onProgress?.("verifying");
    await delay(OTA_VERIFY_INITIAL_DELAY_MS);

    let currentVersion: string | null = null;
    let sawUnverifiableResponse = false;
    for (let attempt = 0; attempt < OTA_VERIFY_MAX_ATTEMPTS; attempt++) {
      const check = await getFirmwareVersion(device.host);
      if (check.reachable) {
        if (check.version && check.version !== previousVersion) {
          currentVersion = check.version;
          break;
        }
        if (!check.version) sawUnverifiableResponse = true;
      }
      await delay(OTA_VERIFY_POLL_INTERVAL_MS);
    }

    if (currentVersion) {
      this.deviceService.update(deviceId, { firmwareVersion: currentVersion });
      return;
    }

    if (sawUnverifiableResponse) {
      // Some firmware variants (e.g. tasmota-minimal) never report a version
      // via Status 2 — the best confirmation available for these is that the
      // device is back up and responding after the push. We can't record an
      // exact version, so clear the stale one rather than keep showing it.
      this.deviceService.update(deviceId, { firmwareVersion: null });
      return;
    }

    throw new OtaVerificationError(
      `Firmware update verification failed: ${device.host} is still reporting version ` +
        `"${previousVersion ?? "unknown"}" after ${OTA_VERIFY_MAX_ATTEMPTS} verification attempts`,
    );
  }

  async delete(id: number) {
    const build = this.getById(id);
    this.db.delete(firmwareBuilds).where(eq(firmwareBuilds.id, id)).run();
    await rm(this.logPath(id), { force: true });
    if (build.binaryFilename) {
      await rm(path.join(config.firmwareOutputDir, build.binaryFilename), { force: true });
    }
    if (build.binaryGzFilename) {
      await rm(path.join(config.firmwareOutputDir, build.binaryGzFilename), { force: true });
    }
  }

  private logPath(id: number) {
    return path.join(this.logDir, `${id}.log`);
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      let next = this.nextQueued();
      while (next) {
        await this.runOne(next.id);
        next = this.nextQueued();
      }
    } finally {
      this.processing = false;
    }
  }

  private nextQueued() {
    return this.db
      .select()
      .from(firmwareBuilds)
      .where(eq(firmwareBuilds.status, "queued"))
      .orderBy(firmwareBuilds.id)
      .get();
  }

  private async runOne(id: number) {
    const build = this.getById(id);
    this.setStatus(id, { status: "building" });

    const logStream = createWriteStream(this.logPath(id), { flags: "a" });
    const onLogLine = (line: string) => {
      logStream.write(line + "\n");
      this.broadcaster?.broadcast({ type: "build.log", payload: { buildId: id, line } });
    };

    try {
      const { binaryPath } = await runBuild({
        baseVersion: build.baseVersion,
        env: build.env,
        overrides: build.overrides,
        buildFlags: build.buildFlags,
        onLogLine,
      });

      const filename = `${id}-${path.basename(binaryPath)}`;
      const destPath = path.join(config.firmwareOutputDir, filename);
      await copyFile(binaryPath, destPath);

      const gzFilename = `${filename}.gz`;
      await writeFile(
        path.join(config.firmwareOutputDir, gzFilename),
        await gzipBuffer(await readFile(destPath)),
      );

      this.setStatus(id, {
        status: "success",
        binaryFilename: filename,
        binaryGzFilename: gzFilename,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus(id, { status: "failed", errorMessage: message, completedAt: new Date().toISOString() });
    } finally {
      logStream.end();
    }
  }

  private setStatus(
    id: number,
    fields: {
      status: "building" | "success" | "failed";
      errorMessage?: string;
      binaryFilename?: string;
      binaryGzFilename?: string;
      completedAt?: string;
    },
  ) {
    this.db.update(firmwareBuilds).set(fields).where(eq(firmwareBuilds.id, id)).run();
    this.broadcaster?.broadcast({
      type: "build.status",
      payload: { buildId: id, status: fields.status, error: fields.errorMessage },
    });
  }
}
