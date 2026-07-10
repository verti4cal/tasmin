import { sql } from "drizzle-orm";
import { blob, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const deviceGroups = sqliteTable("device_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const devices = sqliteTable("devices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  host: text("host").notNull().unique(), // IP or hostname
  mqttTopic: text("mqtt_topic"),
  moduleType: text("module_type"),
  firmwareVersion: text("firmware_version"),
  groupId: integer("group_id").references(() => deviceGroups.id, { onDelete: "set null" }),
  notes: text("notes"),
  lastSeenAt: text("last_seen_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const deviceState = sqliteTable(
  "device_state",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deviceId: integer("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => ({
    deviceIdKeyIdx: uniqueIndex("device_state_device_id_key_idx").on(table.deviceId, table.key),
  }),
);

export const deviceTelemetryLog = sqliteTable(
  "device_telemetry_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deviceId: integer("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    recordedAt: text("recorded_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => ({
    deviceKeyTimeIdx: index("telemetry_device_key_time_idx").on(
      table.deviceId,
      table.key,
      table.recordedAt,
    ),
  }),
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const configBackups = sqliteTable("config_backups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: integer("device_id")
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  data: blob("data", { mode: "buffer" }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const firmwareBuilds = sqliteTable("firmware_builds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  baseVersion: text("base_version").notNull(),
  env: text("env").notNull(),
  overrides: text("overrides").notNull().default(""),
  buildFlags: text("build_flags").notNull().default(""),
  source: text("source", { enum: ["compiled", "prebuilt"] })
    .notNull()
    .default("compiled"),
  status: text("status", { enum: ["queued", "building", "success", "failed"] })
    .notNull()
    .default("queued"),
  errorMessage: text("error_message"),
  binaryFilename: text("binary_filename"),
  binaryGzFilename: text("binary_gz_filename"),
  // Denormalized rather than a foreign key: presets can be renamed/deleted
  // independently, but a build should keep showing what it was built from.
  presetName: text("preset_name"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  completedAt: text("completed_at"),
});

export const buildPresets = sqliteTable("build_presets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  baseVersion: text("base_version").notNull(),
  env: text("env").notNull(),
  overrides: text("overrides").notNull().default(""),
  buildFlags: text("build_flags").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type DeviceGroup = typeof deviceGroups.$inferSelect;
export type NewDeviceGroup = typeof deviceGroups.$inferInsert;
export type ConfigBackup = typeof configBackups.$inferSelect;
export type FirmwareBuild = typeof firmwareBuilds.$inferSelect;
export type BuildPreset = typeof buildPresets.$inferSelect;
export type NewBuildPreset = typeof buildPresets.$inferInsert;
