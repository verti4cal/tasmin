import { describe, expect, it } from "vitest";
import { parseTasmotaPayload } from "./payload.js";

describe("parseTasmotaPayload", () => {
  it("flattens a JSON object into label-prefixed keys", () => {
    expect(parseTasmotaPayload("STATE", '{"POWER":"ON","Dimmer":50}')).toEqual({
      STATE_POWER: "ON",
      STATE_Dimmer: "50",
    });
  });

  it("stringifies nested objects instead of flattening recursively", () => {
    const result = parseTasmotaPayload("STATE", '{"Wifi":{"RSSI":88,"SSId":"home"}}');
    expect(result.STATE_Wifi).toBe(JSON.stringify({ RSSI: 88, SSId: "home" }));
  });

  it("falls back to a raw label/value pair for plain-text payloads", () => {
    expect(parseTasmotaPayload("POWER", "ON")).toEqual({ POWER: "ON" });
    expect(parseTasmotaPayload("LWT", "Online")).toEqual({ LWT: "Online" });
  });

  it("falls back to raw text for JSON arrays (not a flattenable object)", () => {
    expect(parseTasmotaPayload("SOMELIST", "[1,2,3]")).toEqual({ SOMELIST: "[1,2,3]" });
  });
});
