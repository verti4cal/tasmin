import type { DeviceService } from "../../domain/devices/service.js";
import type { DeviceStateService } from "../../domain/devices/stateService.js";
import type { Logger } from "../logger.js";
import { sendTasmotaCommand } from "./client.js";
import { parseTasmotaPayload } from "./payload.js";

/**
 * Fallback for devices without a configured MQTT topic: periodically asks
 * each one for its state over HTTP. Devices reachable via MQTT get pushed
 * updates instead and are excluded here (see DeviceService.listPollable).
 */
export function startHttpPoller(
  devices: DeviceService,
  state: DeviceStateService,
  intervalMs: number,
  logger: Logger,
): NodeJS.Timeout {
  const timer = setInterval(() => {
    void pollOnce(devices, state, logger);
  }, intervalMs);
  timer.unref();
  return timer;
}

async function pollOnce(devices: DeviceService, state: DeviceStateService, logger: Logger) {
  for (const device of devices.listPollable()) {
    try {
      const { raw } = await sendTasmotaCommand(device.host, "Status 11");
      const statusSts = (raw as Record<string, unknown> | undefined)?.StatusSTS;
      if (!statusSts) continue;

      const entries = parseTasmotaPayload("STATE", JSON.stringify(statusSts));
      for (const [key, value] of Object.entries(entries)) {
        state.record(device.id, key, value);
      }
    } catch (err) {
      logger.warn(`Poll failed for device ${device.id} (${device.host}): ${String(err)}`);
    }
  }
}
