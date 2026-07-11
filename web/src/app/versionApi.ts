import { api } from "../lib/apiClient.js";

export const versionApi = {
  get: () => api.get<{ version: string }>("/version"),
};
