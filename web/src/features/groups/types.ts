export interface DeviceGroup {
  id: number;
  name: string;
  createdAt: string;
}

export interface GroupCommandResult {
  deviceId: number;
  deviceName: string;
  ok: boolean;
  error?: string;
}
