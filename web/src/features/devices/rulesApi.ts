import { api } from "../../lib/apiClient.js";

export interface RuleState {
  index: number;
  rule: string;
  enabled: boolean;
}

export const rulesApi = {
  get: (deviceId: number, index: number) =>
    api.get<RuleState>(`/devices/${deviceId}/rules/${index}`),
  update: (deviceId: number, index: number, input: { rule?: string; enabled?: boolean }) =>
    api.put<RuleState>(`/devices/${deviceId}/rules/${index}`, input),
};
