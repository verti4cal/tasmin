import { api } from "../../lib/apiClient.js";
import type { Device, UpdateDeviceInput } from "./types.js";

export const devicesApi = {
  list: () => api.get<Device[]>("/devices"),
  update: (id: number, input: UpdateDeviceInput) => api.patch<Device>(`/devices/${id}`, input),
  remove: (id: number) => api.delete<void>(`/devices/${id}`),
  sendCommand: (id: number, command: string) =>
    api.post<{ raw: unknown }>(`/devices/${id}/command`, { command }),
};
