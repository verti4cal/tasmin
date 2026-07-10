import { gzip } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);

/**
 * Tasmota's own OTA upload path (the same one `/u2` uses) detects a gzip
 * payload and decompresses it on the fly, which is exactly why
 * ota.tasmota.com/GitHub releases ship a `.bin.gz` alongside every `.bin` —
 * it's the recommended file for OTA updates on low-storage/low-bandwidth
 * devices. We generate our own rather than relying on one always being
 * published (compiled builds don't come with one at all), so behavior is
 * identical for compiled and prebuilt firmware.
 */
export function gzipBuffer(data: Buffer): Promise<Buffer> {
  return gzipAsync(data);
}
