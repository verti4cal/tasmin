import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DB_PATH: z.string().default("./data/app.db"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DEVICE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  CORS_ORIGIN: z.string().optional(),
  WEB_DIST_PATH: z.string().optional(),
  MQTT_URL: z.string().optional(), // e.g. mqtt://broker.local:1883 — omit to rely on HTTP polling only

  // Firmware compiler: shelled out as configurable commands so the build
  // queue logic can be exercised against a stub toolchain in tests.
  GIT_COMMAND: z.string().default("git"),
  PIO_COMMAND: z.string().default("pio"),
  TASMOTA_REPO_URL: z.string().default("https://github.com/arendst/Tasmota.git"),
  TASMOTA_SRC_DIR: z.string().default("./data/tasmota-src"),
  FIRMWARE_OUTPUT_DIR: z.string().default("./data/firmware-builds"),

  TELEMETRY_RETENTION_DAYS: z.coerce.number().int().positive().default(14),

  // The host (IP or domain, optionally with a port) at which Tasmota devices
  // on the network can reach this server — used to build the OtaUrl a device
  // pulls its firmware from during a push. The container's own address isn't
  // necessarily reachable from the LAN, so this can't be inferred.
  OTA_URL_DOMAIN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  port: parsed.data.PORT,
  dbPath: parsed.data.DB_PATH,
  logLevel: parsed.data.LOG_LEVEL,
  devicePollIntervalMs: parsed.data.DEVICE_POLL_INTERVAL_MS,
  corsOrigin: parsed.data.CORS_ORIGIN,
  webDistPath: parsed.data.WEB_DIST_PATH,
  mqttUrl: parsed.data.MQTT_URL,
  gitCommand: parsed.data.GIT_COMMAND,
  pioCommand: parsed.data.PIO_COMMAND,
  tasmotaRepoUrl: parsed.data.TASMOTA_REPO_URL,
  tasmotaSrcDir: parsed.data.TASMOTA_SRC_DIR,
  firmwareOutputDir: parsed.data.FIRMWARE_OUTPUT_DIR,
  telemetryRetentionDays: parsed.data.TELEMETRY_RETENTION_DAYS,
  otaUrlDomain: parsed.data.OTA_URL_DOMAIN,
};
