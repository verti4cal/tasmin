/**
 * Normalizes a raw Tasmota payload (JSON object, or plain text like a POWER
 * state or LWT "Online"/"Offline") into flat key/value pairs suitable for
 * device_state rows. Label is the last MQTT topic segment (e.g. "STATE",
 * "SENSOR", "POWER") or a synthetic key for HTTP polling results.
 */
export function parseTasmotaPayload(label: string, rawText: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { [label]: rawText };
  }

  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
        `${label}_${key}`,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      ]),
    );
  }

  return { [label]: rawText };
}
