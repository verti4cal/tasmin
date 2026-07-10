import { and, eq, gte, lt } from "drizzle-orm";
import type { Db } from "../../infra/db/client.js";
import { deviceState, deviceTelemetryLog, devices } from "../../infra/db/schema.js";
import type { Broadcaster } from "../broadcaster.js";

export interface TelemetryPoint {
  value: string;
  recordedAt: string;
}

/**
 * Decouples state recording from the transport that produced it (MQTT
 * message, HTTP poll) and from whatever pushes it to clients, so both the
 * MQTT listener and the poller can share this without depending on Fastify
 * or the WS gateway directly.
 *
 * Every recorded value updates the "latest state" row (device_state) and
 * appends to an append-only history log (device_telemetry_log) for
 * charting; the log is pruned separately since it grows without bound
 * otherwise (see pruneOlderThan).
 */
export class DeviceStateService {
  constructor(
    private readonly db: Db,
    private readonly broadcaster?: Broadcaster,
  ) {}

  record(deviceId: number, key: string, value: string) {
    const updatedAt = new Date().toISOString();

    this.db
      .insert(deviceState)
      .values({ deviceId, key, value, updatedAt })
      .onConflictDoUpdate({
        target: [deviceState.deviceId, deviceState.key],
        set: { value, updatedAt },
      })
      .run();

    this.db
      .insert(deviceTelemetryLog)
      .values({ deviceId, key, value, recordedAt: updatedAt })
      .run();

    this.db.update(devices).set({ lastSeenAt: updatedAt }).where(eq(devices.id, deviceId)).run();

    this.broadcaster?.broadcast({
      type: "device.state",
      payload: { deviceId, key, value, updatedAt },
    });
  }

  getStateMap(deviceId: number): Record<string, string> {
    const rows = this.db.select().from(deviceState).where(eq(deviceState.deviceId, deviceId)).all();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  listTelemetryKeys(deviceId: number): string[] {
    const rows = this.db
      .selectDistinct({ key: deviceTelemetryLog.key })
      .from(deviceTelemetryLog)
      .where(eq(deviceTelemetryLog.deviceId, deviceId))
      .all();
    return rows.map((row) => row.key);
  }

  getTelemetryHistory(deviceId: number, key: string, sinceHours: number): TelemetryPoint[] {
    const cutoff = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
    return this.db
      .select({ value: deviceTelemetryLog.value, recordedAt: deviceTelemetryLog.recordedAt })
      .from(deviceTelemetryLog)
      .where(
        and(
          eq(deviceTelemetryLog.deviceId, deviceId),
          eq(deviceTelemetryLog.key, key),
          gte(deviceTelemetryLog.recordedAt, cutoff),
        ),
      )
      .orderBy(deviceTelemetryLog.recordedAt)
      .all();
  }

  /** Keeps the telemetry log bounded — called once at startup and on an interval. */
  pruneOlderThan(retentionDays: number) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    this.db.delete(deviceTelemetryLog).where(lt(deviceTelemetryLog.recordedAt, cutoff)).run();
  }
}
