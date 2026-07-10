import { describe, expect, it } from "vitest";
import { isFeatureVariant, parseGitHubOwnerRepo } from "./prebuilt.js";

describe("isFeatureVariant", () => {
  it("accepts plain feature binaries", () => {
    expect(isFeatureVariant("tasmota.bin")).toBe(true);
    expect(isFeatureVariant("tasmota-sensors.bin")).toBe(true);
    expect(isFeatureVariant("tasmota-4M.bin")).toBe(true);
    expect(isFeatureVariant("tasmota32.bin")).toBe(true);
    expect(isFeatureVariant("tasmota32c3.bin")).toBe(true);
    expect(isFeatureVariant("tasmota32-bluetooth.bin")).toBe(true);
  });

  it("rejects compressed OTA-only images", () => {
    expect(isFeatureVariant("tasmota-sensors.bin.gz")).toBe(false);
  });

  it("rejects ESP32 full-flash factory images", () => {
    expect(isFeatureVariant("tasmota32.factory.bin")).toBe(false);
    expect(isFeatureVariant("tasmota32-bluetooth.factory.bin")).toBe(false);
  });

  it("rejects safeboot bootloader helpers", () => {
    expect(isFeatureVariant("tasmota32c3-safeboot.bin")).toBe(false);
  });

  it("rejects per-language rebuilds", () => {
    expect(isFeatureVariant("tasmota-DE.bin")).toBe(false);
    expect(isFeatureVariant("tasmota-4M.bin")).toBe(true); // "4M" isn't a language code
  });

  it("rejects non-.bin assets", () => {
    expect(isFeatureVariant("map_all.zip")).toBe(false);
  });
});

describe("parseGitHubOwnerRepo", () => {
  it("parses a standard https github url with .git suffix", () => {
    expect(parseGitHubOwnerRepo("https://github.com/arendst/Tasmota.git")).toEqual({
      owner: "arendst",
      repo: "Tasmota",
    });
  });

  it("parses without a .git suffix", () => {
    expect(parseGitHubOwnerRepo("https://github.com/arendst/Tasmota")).toEqual({
      owner: "arendst",
      repo: "Tasmota",
    });
  });

  it("throws for a non-github or malformed url", () => {
    expect(() => parseGitHubOwnerRepo("https://example.com/")).toThrow();
  });
});
