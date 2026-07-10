import { api } from "../../lib/apiClient.js";

export const otaApi = {
  status: () => api.get<{ running: boolean }>("/ota/status"),
  push: (buildId: number, deviceIds: number[], compressed = false) =>
    api.post<{ status: string; total: number }>("/ota/push", { buildId, deviceIds, compressed }),
};
