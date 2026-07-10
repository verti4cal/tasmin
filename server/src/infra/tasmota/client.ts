import type { Logger } from "../logger.js";

/**
 * Thin wrapper around a Tasmota device's HTTP command API
 * (http://<host>/cm?cmnd=...). MQTT transport is added separately;
 * this is the fallback/manual-command path used by every device.
 */
export interface TasmotaCommandResult {
  raw: unknown;
}

export class TasmotaHttpError extends Error {
  constructor(
    public readonly host: string,
    public override readonly cause: unknown,
  ) {
    super(`Failed to reach Tasmota device at ${host}: ${String(cause)}`);
  }
}

// Defaults to console so requests are still logged (e.g. in tests/scripts)
// before the app wires in the real Pino logger via setTasmotaLogger at startup.
let logger: Logger = console;

/** Every outgoing request to a Tasmota device goes through here, so this is the one place to hook up logging. */
export function setTasmotaLogger(l: Logger): void {
  logger = l;
}

export async function sendTasmotaCommand(
  host: string,
  command: string,
  { timeoutMs = 5000 }: { timeoutMs?: number } = {},
): Promise<TasmotaCommandResult> {
  const url = `http://${host}/cm?cmnd=${encodeURIComponent(command)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  logger.info(`Tasmota request: GET ${url} (command="${command}")`);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const raw = await response.json();
    logger.info(`Tasmota response: GET ${url} -> ${JSON.stringify(raw)}`);
    return { raw };
  } catch (error) {
    logger.warn(`Tasmota request failed: GET ${url} -> ${String(error)}`);
    throw new TasmotaHttpError(host, error);
  } finally {
    clearTimeout(timeout);
  }
}

export function getStatus(host: string) {
  return sendTasmotaCommand(host, "Status 0");
}

export interface FirmwareVersionCheck {
  /** False while the device is unreachable — the expected state for several seconds while it reboots after a flash. */
  reachable: boolean;
  /** Null only when unreachable, or when even the web UI fallback couldn't find a version. */
  version: string | null;
}

// Every Tasmota page (including minimal builds, which still serve the web
// UI for WiFi setup) ends with this footer, rendered by WSContentStop():
// "...<a href='...'>Tasmota %s %s by Theo Arends</a>..." where the first
// %s is TasmotaGlobal.version. Used as a fallback for firmware variants
// whose reduced command set doesn't answer "Status 2".
const VERSION_FROM_HTML_RE = />Tasmota\s+(\d+\.\d+\.\d+)/i;

/** Falls back to scraping the version out of the main page's footer when Status 2 isn't supported (e.g. tasmota-minimal). */
async function fetchVersionFromWebUi(host: string, { timeoutMs = 5000 } = {}): Promise<string | null> {
  const url = `http://${host}/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  logger.info(`Tasmota request: GET ${url} (version fallback via web UI)`);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(VERSION_FROM_HTML_RE);
    logger.info(`Tasmota response: GET ${url} -> version ${match?.[1] ?? "not found"}`);
    return match?.[1] ?? null;
  } catch (error) {
    logger.warn(`Tasmota request failed: GET ${url} -> ${String(error)}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Used to verify an OTA update actually took effect: polls the lightweight
 * firmware-only status section rather than the full "Status 0" dump. Falls
 * back to scraping the main page's footer when the device's command set
 * doesn't support Status 2 at all (reduced-command firmware variants reply
 * "Command Unknown" instead of a version).
 */
export async function getFirmwareVersion(
  host: string,
  { timeoutMs = 5000 } = {},
): Promise<FirmwareVersionCheck> {
  try {
    const { raw } = await sendTasmotaCommand(host, "Status 2", { timeoutMs });
    if (raw !== null && typeof raw === "object") {
      const firmware = (raw as { StatusFWR?: { Version?: string } }).StatusFWR;
      if (firmware?.Version) return { reachable: true, version: firmware.Version };
    }
    return { reachable: true, version: await fetchVersionFromWebUi(host, { timeoutMs }) };
  } catch {
    return { reachable: false, version: null };
  }
}

export interface TasmotaProbeResult {
  name: string;
  firmwareVersion?: string;
}

/**
 * Used by the subnet scanner: asks a host for its full status with a short
 * timeout suited to probing addresses that mostly won't answer, and returns
 * null (rather than throwing) for anything that isn't a Tasmota device —
 * that's the expected outcome for nearly every address in a scanned subnet.
 */
export async function probeTasmotaDevice(
  host: string,
  { timeoutMs = 800 }: { timeoutMs?: number } = {},
): Promise<TasmotaProbeResult | null> {
  try {
    const { raw } = await sendTasmotaCommand(host, "Status 0", { timeoutMs });
    if (raw === null || typeof raw !== "object" || !("Status" in raw)) return null;

    const status = (raw as { Status?: { FriendlyName?: string[]; DeviceName?: string } }).Status;
    const firmware = (raw as { StatusFWR?: { Version?: string } }).StatusFWR;

    return {
      name: status?.FriendlyName?.[0] || status?.DeviceName || host,
      firmwareVersion: firmware?.Version,
    };
  } catch {
    return null;
  }
}

/**
 * Downloads the device's full configuration dump (the same file the
 * "Backup Configuration" button in Tasmota's own web UI produces).
 */
export async function downloadConfig(host: string, { timeoutMs = 10_000 } = {}): Promise<Buffer> {
  const url = `http://${host}/dl`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  logger.info(`Tasmota request: GET ${url}`);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    logger.info(`Tasmota response: GET ${url} -> ${buffer.byteLength} bytes`);
    return buffer;
  } catch (error) {
    logger.warn(`Tasmota request failed: GET ${url} -> ${String(error)}`);
    throw new TasmotaHttpError(host, error);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Restores a configuration dump via the same multipart upload endpoint
 * Tasmota's "Restore Configuration" page posts to. The device reboots on
 * success, so failures here can also just mean it dropped the connection
 * while restarting rather than a genuine error — callers should treat this
 * as best-effort and verify the device afterwards.
 */
export async function uploadConfig(
  host: string,
  data: Buffer,
  filename: string,
  { timeoutMs = 20_000 } = {},
): Promise<void> {
  const url = `http://${host}/u3`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const form = new FormData();
  form.set("file", new Blob([data]), filename);

  logger.info(`Tasmota request: POST ${url} (file="${filename}", ${data.byteLength} bytes)`);

  try {
    const response = await fetch(url, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    logger.info(`Tasmota response: POST ${url} -> HTTP ${response.status}`);
  } catch (error) {
    logger.warn(`Tasmota request failed: POST ${url} -> ${String(error)}`);
    throw new TasmotaHttpError(host, error);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Triggers a pull-based OTA update: points the device's OtaUrl at a firmware
 * URL we host, then issues Upgrade to make it fetch and flash that URL
 * itself. Preferred over uploading the binary directly because the device
 * manages its own download (retries, memory, no risk of us holding the full
 * file in memory), and it's how Tasmota's own web UI "Firmware Upgrade by
 * URL" flow works. The device reboots once it starts flashing, so a dropped
 * connection on the Upgrade command is expected and not itself a failure.
 */
export async function startPullOta(host: string, firmwareUrl: string): Promise<void> {
  await sendTasmotaCommand(host, `OtaUrl ${firmwareUrl}`);
  await sendTasmotaCommand(host, "Upgrade 1");
}
