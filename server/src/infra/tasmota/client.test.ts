import { afterEach, describe, expect, it, vi } from "vitest";
import { getFirmwareVersion } from "./client.js";

describe("getFirmwareVersion", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the version from Status 2 when the device supports it", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ StatusFWR: { Version: "13.2.0(tasmota)" } }), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await getFirmwareVersion("192.0.2.1");

    expect(result).toEqual({ reachable: true, version: "13.2.0(tasmota)" });
  });

  it("falls back to scraping the web UI footer when Status 2 replies Command Unknown (e.g. tasmota-minimal)", async () => {
    global.fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("cmnd=")) {
        return new Response(JSON.stringify({ Command: "Unknown", Input: "STATUS 2" }), { status: 200 });
      }
      return new Response(
        "<html><body><div style='text-align:right;'><a href='https://github.com/arendst/Tasmota'>" +
          "Tasmota 13.2.0 (minimal) by Theo Arends</a></div></body></html>",
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const result = await getFirmwareVersion("192.0.2.1");

    expect(result).toEqual({ reachable: true, version: "13.2.0" });
  });

  it("reports unreachable when the command request itself fails (device still rebooting)", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const result = await getFirmwareVersion("192.0.2.1");

    expect(result).toEqual({ reachable: false, version: null });
  });

  it("stays reachable-with-null when even the web UI fallback has no recognizable version", async () => {
    global.fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("cmnd=")) {
        return new Response(JSON.stringify({ Command: "Unknown" }), { status: 200 });
      }
      return new Response("<html><body>nothing here</body></html>", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await getFirmwareVersion("192.0.2.1");

    expect(result).toEqual({ reachable: true, version: null });
  });
});
