import { eq, isNull } from "drizzle-orm";
import type { Db } from "../../infra/db/client.js";
import { devices, type Device } from "../../infra/db/schema.js";
import { sendTasmotaCommand } from "../../infra/tasmota/client.js";
import { ConflictError, NotFoundError } from "../errors.js";
import type { DeviceStateService } from "./stateService.js";
import type { CreateDeviceInput, UpdateDeviceInput } from "./types.js";

export type DeviceWithState = Device & { state: Record<string, string> };

/**
 * Framework-agnostic device management. No knowledge of HTTP/Fastify here
 * so it stays independently testable and reusable (e.g. from the poller).
 */
export class DeviceService {
  constructor(
    private readonly db: Db,
    private readonly stateService?: DeviceStateService,
  ) {}

  private withState(device: Device): DeviceWithState {
    return { ...device, state: this.stateService?.getStateMap(device.id) ?? {} };
  }

  list() {
    return this.db.select().from(devices).all();
  }

  listWithState(): DeviceWithState[] {
    return this.list().map((device) => this.withState(device));
  }

  getById(id: number) {
    const device = this.db.select().from(devices).where(eq(devices.id, id)).get();
    if (!device) throw new NotFoundError("Device", id);
    return device;
  }

  getByIdWithState(id: number): DeviceWithState {
    return this.withState(this.getById(id));
  }

  /** Devices with a configured MQTT topic are updated via MQTT and skipped by the HTTP poller. */
  listPollable() {
    return this.db.select().from(devices).where(isNull(devices.mqttTopic)).all();
  }

  findByMqttTopic(topic: string) {
    return this.db.select().from(devices).where(eq(devices.mqttTopic, topic)).get();
  }

  listByGroup(groupId: number) {
    return this.db.select().from(devices).where(eq(devices.groupId, groupId)).all();
  }

  findByHost(host: string) {
    return this.db.select().from(devices).where(eq(devices.host, host)).get();
  }

  create(input: CreateDeviceInput) {
    const existing = this.findByHost(input.host);
    if (existing) throw new ConflictError(`A device with host "${input.host}" already exists`);

    return this.db.insert(devices).values(input).returning().get();
  }

  update(id: number, input: UpdateDeviceInput) {
    this.getById(id); // throws NotFoundError if missing
    return this.db.update(devices).set(input).where(eq(devices.id, id)).returning().get();
  }

  delete(id: number) {
    this.getById(id);
    this.db.delete(devices).where(eq(devices.id, id)).run();
  }

  async sendCommand(id: number, command: string) {
    const device = this.getById(id);
    const result = await sendTasmotaCommand(device.host, command);

    this.db
      .update(devices)
      .set({ lastSeenAt: new Date().toISOString() })
      .where(eq(devices.id, id))
      .run();

    // Command responses report the resulting state directly (e.g. Power
    // Toggle -> {"POWER":"ON"}) — record it immediately so the UI reflects
    // the change right away instead of waiting for the next poll/MQTT tick.
    if (this.stateService && result.raw !== null && typeof result.raw === "object") {
      for (const [key, value] of Object.entries(result.raw as Record<string, unknown>)) {
        this.stateService.record(id, key, typeof value === "object" ? JSON.stringify(value) : String(value));
      }
    }

    return result;
  }
}
