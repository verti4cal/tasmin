export interface Device {
  id: number;
  name: string;
  host: string;
  mqttTopic: string | null;
  moduleType: string | null;
  firmwareVersion: string | null;
  groupId: number | null;
  notes: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  state: Record<string, string>;
}

export interface UpdateDeviceInput {
  name?: string;
  host?: string;
  mqttTopic?: string;
  moduleType?: string;
  groupId?: number | null;
  notes?: string;
}
