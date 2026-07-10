import { probeTasmotaDevice } from "../../infra/tasmota/client.js";
import { runWithConcurrency } from "../../infra/util/concurrency.js";
import type { Broadcaster } from "../broadcaster.js";
import type { DeviceService } from "./service.js";

export interface ScanOptions {
  concurrency?: number;
  timeoutMs?: number;
}

/**
 * Replaces manual "add device by IP" with a subnet sweep: probes every host
 * in the given range and adds anything that answers like a Tasmota device.
 * Runs in the background — callers get progress via the broadcaster
 * (scan.status/scan.progress/scan.device), not a blocking response, since a
 * few hundred addresses at realistic per-host timeouts can take a while.
 */
export class ScanService {
  private running = false;

  constructor(
    private readonly deviceService: DeviceService,
    private readonly broadcaster?: Broadcaster,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async scanHosts(hosts: string[], { concurrency = 32, timeoutMs = 800 }: ScanOptions = {}): Promise<void> {
    this.running = true;
    let scanned = 0;
    let added = 0;

    this.broadcaster?.broadcast({ type: "scan.status", payload: { status: "started", total: hosts.length } });

    try {
      await runWithConcurrency(hosts, concurrency, async (host) => {
        const probe = await probeTasmotaDevice(host, { timeoutMs });
        if (probe) {
          const device = this.addIfNew(host, probe);
          if (device) {
            added += 1;
            this.broadcaster?.broadcast({ type: "scan.device", payload: device });
          }
        }
        scanned += 1;
        this.broadcaster?.broadcast({ type: "scan.progress", payload: { scanned, total: hosts.length } });
      });
    } finally {
      this.running = false;
      this.broadcaster?.broadcast({
        type: "scan.status",
        payload: { status: "complete", total: hosts.length, scanned, added },
      });
    }
  }

  private addIfNew(host: string, probe: { name: string; firmwareVersion?: string }) {
    if (this.deviceService.findByHost(host)) return null;
    return this.deviceService.create({ name: probe.name, host, firmwareVersion: probe.firmwareVersion });
  }
}
