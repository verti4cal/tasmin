import { api, ApiError } from "../../lib/apiClient.js";
import type { BuildPreset, CreateBuildInput, FirmwareBuild, PrebuiltVariant } from "./types.js";

export const firmwareApi = {
  listTags: () => api.get<string[]>("/firmware/tags"),
  listBuilds: () => api.get<FirmwareBuild[]>("/firmware/builds"),
  createBuild: (input: CreateBuildInput) => api.post<FirmwareBuild>("/firmware/builds", input),
  listPrebuiltVariants: (version: string) =>
    api.get<PrebuiltVariant[]>(`/firmware/prebuilt/variants?version=${encodeURIComponent(version)}`),
  downloadPrebuilt: (baseVersion: string, env: string) =>
    api.post<FirmwareBuild>("/firmware/prebuilt", { baseVersion, env }),
  deleteBuild: (id: number) => api.delete<void>(`/firmware/builds/${id}`),
  pushToDevice: (id: number, deviceId: number, compressed = false) =>
    api.post<{ status: string }>(`/firmware/builds/${id}/push/${deviceId}`, { compressed }),
  downloadUrl: (id: number, compressed = false) =>
    `/api/firmware/builds/${id}/download${compressed ? "?compressed=true" : ""}`,

  async getLog(id: number): Promise<string> {
    const response = await fetch(`/api/firmware/builds/${id}/log`);
    if (!response.ok) throw new ApiError(response.status, "Failed to load build log");
    return response.text();
  },

  listPresets: () => api.get<BuildPreset[]>("/firmware/presets"),
  createPreset: (input: CreateBuildInput & { name: string }) =>
    api.post<BuildPreset>("/firmware/presets", input),
  deletePreset: (id: number) => api.delete<void>(`/firmware/presets/${id}`),
};
