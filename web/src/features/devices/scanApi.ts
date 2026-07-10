import { api } from "../../lib/apiClient.js";

export const scanApi = {
  status: () => api.get<{ running: boolean }>("/network/scan/status"),
  start: (subnet: string) => api.post<{ status: string; total: number }>("/network/scan", { subnet }),
};
