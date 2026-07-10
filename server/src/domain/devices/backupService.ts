import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../../infra/db/client.js";
import { configBackups } from "../../infra/db/schema.js";
import { downloadConfig, uploadConfig } from "../../infra/tasmota/client.js";
import { NotFoundError } from "../errors.js";
import type { DeviceService } from "./service.js";

/**
 * Config backup/restore against a device's own dump format (the same file
 * Tasmota's "Backup Configuration" / "Restore Configuration" pages use).
 */
export class BackupService {
  constructor(
    private readonly db: Db,
    private readonly deviceService: DeviceService,
  ) {}

  async create(deviceId: number) {
    const device = this.deviceService.getById(deviceId);
    const data = await downloadConfig(device.host);
    const safeName = device.name.replace(/[^a-z0-9-_]+/gi, "_");
    const filename = `${safeName}-${Date.now()}.dmp`;

    return this.db
      .insert(configBackups)
      .values({ deviceId, filename, data, sizeBytes: data.byteLength })
      .returning({
        id: configBackups.id,
        deviceId: configBackups.deviceId,
        filename: configBackups.filename,
        sizeBytes: configBackups.sizeBytes,
        createdAt: configBackups.createdAt,
      })
      .get();
  }

  list(deviceId: number) {
    return this.db
      .select({
        id: configBackups.id,
        deviceId: configBackups.deviceId,
        filename: configBackups.filename,
        sizeBytes: configBackups.sizeBytes,
        createdAt: configBackups.createdAt,
      })
      .from(configBackups)
      .where(eq(configBackups.deviceId, deviceId))
      .orderBy(desc(configBackups.createdAt))
      .all();
  }

  getWithBlob(deviceId: number, backupId: number) {
    const row = this.db
      .select()
      .from(configBackups)
      .where(and(eq(configBackups.id, backupId), eq(configBackups.deviceId, deviceId)))
      .get();
    if (!row) throw new NotFoundError("Backup", backupId);
    return row;
  }

  async restore(deviceId: number, backupId: number) {
    const device = this.deviceService.getById(deviceId);
    const backup = this.getWithBlob(deviceId, backupId);
    await uploadConfig(device.host, backup.data, backup.filename);
  }

  delete(deviceId: number, backupId: number) {
    this.getWithBlob(deviceId, backupId); // throws NotFoundError if missing
    this.db
      .delete(configBackups)
      .where(and(eq(configBackups.id, backupId), eq(configBackups.deviceId, deviceId)))
      .run();
  }
}
