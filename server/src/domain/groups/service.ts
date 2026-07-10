import { eq } from "drizzle-orm";
import type { Db } from "../../infra/db/client.js";
import { deviceGroups } from "../../infra/db/schema.js";
import type { DeviceService } from "../devices/service.js";
import { NotFoundError } from "../errors.js";

export interface GroupCommandResult {
  deviceId: number;
  deviceName: string;
  ok: boolean;
  error?: string;
}

export class GroupService {
  constructor(
    private readonly db: Db,
    private readonly deviceService: DeviceService,
  ) {}

  list() {
    return this.db.select().from(deviceGroups).all();
  }

  create(name: string) {
    return this.db.insert(deviceGroups).values({ name }).returning().get();
  }

  delete(id: number) {
    const existing = this.db.select().from(deviceGroups).where(eq(deviceGroups.id, id)).get();
    if (!existing) throw new NotFoundError("Device group", id);
    this.db.delete(deviceGroups).where(eq(deviceGroups.id, id)).run();
  }

  /** Fans a command out to every device in the group; one device failing doesn't stop the rest. */
  async sendCommand(groupId: number, command: string): Promise<GroupCommandResult[]> {
    const members = this.deviceService.listByGroup(groupId);

    return Promise.all(
      members.map(async (device): Promise<GroupCommandResult> => {
        try {
          await this.deviceService.sendCommand(device.id, command);
          return { deviceId: device.id, deviceName: device.name, ok: true };
        } catch (err) {
          return {
            deviceId: device.id,
            deviceName: device.name,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );
  }
}
