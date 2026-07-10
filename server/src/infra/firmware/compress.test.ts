import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { gzipBuffer } from "./compress.js";

describe("gzipBuffer", () => {
  it("produces a gzip buffer that decompresses back to the original bytes", async () => {
    const original = Buffer.from("tasmota-firmware-binary-contents");

    const compressed = await gzipBuffer(original);

    expect(compressed).not.toEqual(original);
    expect(gunzipSync(compressed)).toEqual(original);
  });
});
