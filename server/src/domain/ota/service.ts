import { runWithConcurrency } from "../../infra/util/concurrency.js";
import type { Broadcaster } from "../broadcaster.js";
import type { BuildQueue } from "../firmware/queue.js";

const DEFAULT_CONCURRENCY = 3;

/**
 * Bulk-pushes one firmware build to many devices at once. Reuses
 * BuildQueue.pushToDevice for the actual per-device OTA upload (so a single
 * push and a bulk push behave identically — same firmwareVersion bookkeeping,
 * same error handling), and streams per-device progress over WS rather than
 * blocking on the whole batch. One run at a time, mirroring ScanService.
 */
export class OtaService {
  private running = false;

  constructor(
    private readonly buildQueue: BuildQueue,
    private readonly broadcaster?: Broadcaster,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async pushToDevices(
    buildId: number,
    deviceIds: number[],
    { compressed = false }: { compressed?: boolean } = {},
  ): Promise<void> {
    this.running = true;
    this.broadcaster?.broadcast({
      type: "ota.status",
      payload: { status: "started", total: deviceIds.length },
    });

    try {
      await runWithConcurrency(deviceIds, DEFAULT_CONCURRENCY, async (deviceId) => {
        this.broadcaster?.broadcast({ type: "ota.device", payload: { deviceId, status: "pushing" } });
        try {
          await this.buildQueue.pushToDevice(buildId, deviceId, {
            compressed,
            onProgress: (status) => this.broadcaster?.broadcast({ type: "ota.device", payload: { deviceId, status } }),
          });
          this.broadcaster?.broadcast({ type: "ota.device", payload: { deviceId, status: "success" } });
        } catch (err) {
          this.broadcaster?.broadcast({
            type: "ota.device",
            payload: {
              deviceId,
              status: "failed",
              error: err instanceof Error ? err.message : String(err),
            },
          });
        }
      });
    } finally {
      this.running = false;
      this.broadcaster?.broadcast({ type: "ota.status", payload: { status: "complete" } });
    }
  }
}
