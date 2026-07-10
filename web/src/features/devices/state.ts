import type { Device } from "./types.js";

/**
 * Tasmota reports power state under different keys depending on transport
 * (bare MQTT "POWER" topic vs. the "STATE_POWER" field from a Status 11
 * poll) and relay count ("POWER1", "STATE_POWER1" on multi-relay devices).
 */
export function getPowerState(state: Device["state"]): string | undefined {
  return state.POWER ?? state.STATE_POWER ?? state.POWER1 ?? state.STATE_POWER1;
}

export function getRssi(state: Device["state"]): number | undefined {
  const wifiJson = state.STATE_Wifi ?? state.SENSOR_Wifi;
  if (!wifiJson) return undefined;
  try {
    const parsed = JSON.parse(wifiJson) as { RSSI?: number };
    return parsed.RSSI;
  } catch {
    return undefined;
  }
}
