import { api } from "../../lib/apiClient.js";

export interface TelemetryPoint {
  value: string;
  recordedAt: string;
}

export const telemetryApi = {
  keys: (deviceId: number) => api.get<string[]>(`/devices/${deviceId}/telemetry/keys`),
  history: (deviceId: number, key: string, hours = 24) =>
    api.get<TelemetryPoint[]>(
      `/devices/${deviceId}/telemetry?key=${encodeURIComponent(key)}&hours=${hours}`,
    ),
};
