import { api } from "../../lib/apiClient.js";
import type { DeviceGroup, GroupCommandResult } from "./types.js";

export const groupsApi = {
  list: () => api.get<DeviceGroup[]>("/groups"),
  create: (name: string) => api.post<DeviceGroup>("/groups", { name }),
  remove: (id: number) => api.delete<void>(`/groups/${id}`),
  sendCommand: (id: number, command: string) =>
    api.post<GroupCommandResult[]>(`/groups/${id}/command`, { command }),
};
