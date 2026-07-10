import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../infra/db/schema.js";
import { firmwareBuilds } from "../../infra/db/schema.js";

vi.mock("../../config.js", () => ({
  config: {
    firmwareOutputDir: "/tmp/tasmin-test-firmware",
    otaUrlDomain: "192.0.2.100:3000",
  },
}));

vi.mock("../../infra/tasmota/client.js", () => ({
  startPullOta: vi.fn(async () => undefined),
  getFirmwareVersion: vi.fn(async () => ({ reachable: true, version: "v14.0.0" })),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(async () => Buffer.from("firmware-bytes")),
  rm: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
}));

vi.mock("node:timers/promises", () => ({
  setTimeout: vi.fn(async () => undefined),
}));

const { startPullOta, getFirmwareVersion } = await import("../../infra/tasmota/client.js");
const { BuildQueue } = await import("./queue.js");

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "../../infra/db/migrations");

function makeDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  return db;
}

function fakeDeviceService(host = "192.0.2.1", firmwareVersion: string | null = "v13.0.0") {
  return {
    getById: vi.fn(() => ({ id: 1, host, firmwareVersion })),
    update: vi.fn(),
  } as unknown as ConstructorParameters<typeof BuildQueue>[1];
}

describe("BuildQueue firmware push", () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    vi.clearAllMocks();
    vi.mocked(getFirmwareVersion).mockResolvedValue({ reachable: true, version: "v14.0.0" });
  });

  function insertBuild(overrides: Partial<typeof firmwareBuilds.$inferInsert> = {}) {
    return db
      .insert(firmwareBuilds)
      .values({
        baseVersion: "v14.0.0",
        env: "tasmota",
        overrides: "",
        buildFlags: "",
        source: "prebuilt",
        status: "success",
        binaryFilename: "1-tasmota.bin",
        binaryGzFilename: "1-tasmota.bin.gz",
        completedAt: new Date().toISOString(),
        ...overrides,
      })
      .returning()
      .get();
  }

  describe("getBinaryPath", () => {
    it("returns the raw filename by default", () => {
      const build = insertBuild();
      const queue = new BuildQueue(db, fakeDeviceService());

      expect(queue.getBinaryPath(build.id)).toContain("1-tasmota.bin");
      expect(queue.getBinaryPath(build.id)).not.toContain(".gz");
    });

    it("returns the .gz filename when compressed is requested", () => {
      const build = insertBuild();
      const queue = new BuildQueue(db, fakeDeviceService());

      expect(queue.getBinaryPath(build.id, { compressed: true })).toContain("1-tasmota.bin.gz");
    });

    it("throws when no compressed variant exists", () => {
      const build = insertBuild({ binaryGzFilename: null });
      const queue = new BuildQueue(db, fakeDeviceService());

      expect(() => queue.getBinaryPath(build.id, { compressed: true })).toThrow();
    });
  });

  describe("pushToDevice", () => {
    it("tells the device to pull the compressed variant when compressed is requested", async () => {
      const build = insertBuild();
      const queue = new BuildQueue(db, fakeDeviceService());

      await queue.pushToDevice(build.id, 1, { compressed: true });

      expect(startPullOta).toHaveBeenCalledWith(
        "192.0.2.1",
        `http://192.0.2.100:3000/api/firmware/builds/${build.id}/download?compressed=true`,
      );
    });

    it("tells the device to pull the raw binary by default", async () => {
      const build = insertBuild();
      const queue = new BuildQueue(db, fakeDeviceService());

      await queue.pushToDevice(build.id, 1);

      expect(startPullOta).toHaveBeenCalledWith(
        "192.0.2.1",
        `http://192.0.2.100:3000/api/firmware/builds/${build.id}/download`,
      );
    });

    it("throws a clear error when OTA_URL_DOMAIN isn't configured", async () => {
      const { config } = await import("../../config.js");
      const originalDomain = config.otaUrlDomain;
      config.otaUrlDomain = undefined;
      try {
        const build = insertBuild();
        const queue = new BuildQueue(db, fakeDeviceService());

        await expect(queue.pushToDevice(build.id, 1)).rejects.toThrow(/OTA_URL_DOMAIN/);
        expect(startPullOta).not.toHaveBeenCalled();
      } finally {
        config.otaUrlDomain = originalDomain;
      }
    });

    it("verifies success by polling for a firmware version change rather than trusting the upgrade command's response", async () => {
      const build = insertBuild();
      const deviceService = fakeDeviceService("192.0.2.1", "v13.0.0");
      const queue = new BuildQueue(db, deviceService);
      vi.mocked(getFirmwareVersion).mockResolvedValue({ reachable: true, version: "v14.0.0" });

      await queue.pushToDevice(build.id, 1);

      expect(deviceService.update).toHaveBeenCalledWith(1, { firmwareVersion: "v14.0.0" });
    });

    it("keeps polling until the version changes, up to the max attempts", async () => {
      const build = insertBuild();
      const deviceService = fakeDeviceService("192.0.2.1", "v13.0.0");
      const queue = new BuildQueue(db, deviceService);
      vi.mocked(getFirmwareVersion)
        .mockResolvedValueOnce({ reachable: false, version: null }) // still rebooting
        .mockResolvedValueOnce({ reachable: true, version: "v13.0.0" }) // back up, but hasn't flashed yet
        .mockResolvedValueOnce({ reachable: true, version: "v14.0.0" }); // now it's changed

      await queue.pushToDevice(build.id, 1);

      expect(getFirmwareVersion).toHaveBeenCalledTimes(3);
      expect(deviceService.update).toHaveBeenCalledWith(1, { firmwareVersion: "v14.0.0" });
    });

    it("throws instead of polling forever when the version never changes", async () => {
      const build = insertBuild();
      const deviceService = fakeDeviceService("192.0.2.1", "v13.0.0");
      const queue = new BuildQueue(db, deviceService);
      vi.mocked(getFirmwareVersion).mockResolvedValue({ reachable: true, version: "v13.0.0" }); // never changes

      await expect(queue.pushToDevice(build.id, 1)).rejects.toThrow(/verification failed/i);

      expect(getFirmwareVersion).toHaveBeenCalledTimes(12); // bounded, not infinite
      expect(deviceService.update).not.toHaveBeenCalled();
    });

    it("still verifies via polling even if starting the pull OTA itself throws (device may drop the connection on reboot)", async () => {
      const build = insertBuild();
      const deviceService = fakeDeviceService("192.0.2.1", "v13.0.0");
      const queue = new BuildQueue(db, deviceService);
      vi.mocked(startPullOta).mockRejectedValueOnce(new Error("socket hang up"));
      vi.mocked(getFirmwareVersion).mockResolvedValue({ reachable: true, version: "v14.0.0" });

      await queue.pushToDevice(build.id, 1);

      expect(deviceService.update).toHaveBeenCalledWith(1, { firmwareVersion: "v14.0.0" });
    });

    it("reports a verifying progress callback before polling starts", async () => {
      const build = insertBuild();
      const queue = new BuildQueue(db, fakeDeviceService());
      const onProgress = vi.fn();

      await queue.pushToDevice(build.id, 1, { onProgress });

      expect(onProgress).toHaveBeenCalledWith("verifying");
    });

    it("clears the stale version instead of failing when the device is reachable but its firmware never reports one (e.g. tasmota-minimal)", async () => {
      const build = insertBuild();
      const deviceService = fakeDeviceService("192.0.2.1", "v13.0.0");
      const queue = new BuildQueue(db, deviceService);
      // Every attempt: reachable, but "Command Unknown" for Status 2 — this
      // is what tasmota-minimal's reduced command set returns.
      vi.mocked(getFirmwareVersion).mockResolvedValue({ reachable: true, version: null });

      await queue.pushToDevice(build.id, 1);

      expect(deviceService.update).toHaveBeenCalledWith(1, { firmwareVersion: null });
    });

    it("still fails if the device never becomes reachable at all, even without version support", async () => {
      const build = insertBuild();
      const deviceService = fakeDeviceService("192.0.2.1", "v13.0.0");
      const queue = new BuildQueue(db, deviceService);
      vi.mocked(getFirmwareVersion).mockResolvedValue({ reachable: false, version: null });

      await expect(queue.pushToDevice(build.id, 1)).rejects.toThrow(/verification failed/i);
      expect(deviceService.update).not.toHaveBeenCalled();
    });
  });
});
