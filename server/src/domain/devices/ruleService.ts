import type { DeviceService } from "./service.js";

export const RULE_INDEXES = [1, 2, 3] as const;
export type RuleIndex = (typeof RULE_INDEXES)[number];

export function isRuleIndex(value: number): value is RuleIndex {
  return (RULE_INDEXES as readonly number[]).includes(value);
}

export interface RuleState {
  index: RuleIndex;
  rule: string;
  enabled: boolean;
}

/**
 * Wraps Tasmota's `Rule<N>` console command family. Tasmota supports three
 * independent rule slots (Rule1/2/3); each holds one rule script and an
 * enabled flag, both readable/settable via the same command name.
 */
export class RuleService {
  constructor(private readonly deviceService: DeviceService) {}

  async get(deviceId: number, index: RuleIndex): Promise<RuleState> {
    const { raw } = await this.deviceService.sendCommand(deviceId, `Rule${index}`);
    const entry = (raw as Record<string, { Rules?: string; Enabled?: boolean } | undefined>)[
      `Rule${index}`
    ];
    return { index, rule: entry?.Rules ?? "", enabled: Boolean(entry?.Enabled) };
  }

  async setRule(deviceId: number, index: RuleIndex, rule: string): Promise<RuleState> {
    await this.deviceService.sendCommand(deviceId, `Rule${index} ${rule}`);
    return this.get(deviceId, index);
  }

  async setEnabled(deviceId: number, index: RuleIndex, enabled: boolean): Promise<RuleState> {
    await this.deviceService.sendCommand(deviceId, `Rule${index} ${enabled ? 1 : 0}`);
    return this.get(deviceId, index);
  }
}
