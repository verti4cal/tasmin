import { describe, expect, it, vi } from "vitest";
import type { BackupService } from "../devices/backupService.js";
import type { BuildQueue } from "../firmware/queue.js";
import { OtaService } from "./service.js";

function fakeBuildQueue(impl?: (buildId: number, deviceId: number, opts?: unknown) => Promise<void>) {
  return {
    pushToDevice: vi.fn(impl ?? (async () => undefined)),
  } as unknown as BuildQueue;
}

function fakeBackupService(impl?: (deviceId: number) => Promise<unknown>) {
  return {
    create: vi.fn(impl ?? (async () => ({ id: 1 }))),
  } as unknown as BackupService;
}

describe("OtaService.pushToDevices", () => {
  it("backs up each device before pushing by default", async () => {
    const backups = fakeBackupService();
    const queue = fakeBuildQueue();
    const ota = new OtaService(queue, backups);

    await ota.pushToDevices(1, [10, 20]);

    expect(backups.create).toHaveBeenCalledWith(10);
    expect(backups.create).toHaveBeenCalledWith(20);
    expect(queue.pushToDevice).toHaveBeenCalledWith(1, 10, expect.anything());
    expect(queue.pushToDevice).toHaveBeenCalledWith(1, 20, expect.anything());
  });

  it("skips the backup when backupFirst is false", async () => {
    const backups = fakeBackupService();
    const queue = fakeBuildQueue();
    const ota = new OtaService(queue, backups);

    await ota.pushToDevices(1, [10], { backupFirst: false });

    expect(backups.create).not.toHaveBeenCalled();
    expect(queue.pushToDevice).toHaveBeenCalledWith(1, 10, expect.anything());
  });

  it("still pushes firmware to a device even when its backup failed", async () => {
    const backups = fakeBackupService(async (deviceId) => {
      if (deviceId === 10) throw new Error("device unreachable");
      return { id: 1 };
    });
    const queue = fakeBuildQueue();
    const ota = new OtaService(queue, backups);

    await ota.pushToDevices(1, [10, 20]);

    expect(queue.pushToDevice).toHaveBeenCalledWith(1, 10, expect.anything());
    expect(queue.pushToDevice).toHaveBeenCalledWith(1, 20, expect.anything());
  });

  it("broadcasts success (not failed) for a device whose backup failed but whose push succeeded", async () => {
    const backups = fakeBackupService(async () => {
      throw new Error("device unreachable");
    });
    const queue = fakeBuildQueue();
    const broadcaster = { broadcast: vi.fn() };
    const ota = new OtaService(queue, backups, broadcaster);

    await ota.pushToDevices(1, [10]);

    expect(broadcaster.broadcast).toHaveBeenCalledWith({
      type: "ota.device",
      payload: { deviceId: 10, status: "backing-up" },
    });
    expect(broadcaster.broadcast).toHaveBeenCalledWith({
      type: "ota.device",
      payload: { deviceId: 10, status: "pushing" },
    });
    expect(broadcaster.broadcast).toHaveBeenCalledWith({
      type: "ota.device",
      payload: { deviceId: 10, status: "success" },
    });
    expect(queue.pushToDevice).toHaveBeenCalledWith(1, 10, expect.anything());
  });
});
