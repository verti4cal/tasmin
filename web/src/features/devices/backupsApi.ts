import { api } from "../../lib/apiClient.js";

export interface ConfigBackup {
  id: number;
  deviceId: number;
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export const backupsApi = {
  list: (deviceId: number) => api.get<ConfigBackup[]>(`/devices/${deviceId}/backups`),
  create: (deviceId: number) => api.post<ConfigBackup>(`/devices/${deviceId}/backups`),
  restore: (deviceId: number, backupId: number) =>
    api.post<{ status: string }>(`/devices/${deviceId}/backups/${backupId}/restore`),
  remove: (deviceId: number, backupId: number) =>
    api.delete<void>(`/devices/${deviceId}/backups/${backupId}`),
  downloadUrl: (deviceId: number, backupId: number) =>
    `/api/devices/${deviceId}/backups/${backupId}/download`,
};
