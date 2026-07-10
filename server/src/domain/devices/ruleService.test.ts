import { describe, expect, it, vi } from "vitest";
import { isRuleIndex, RuleService } from "./ruleService.js";
import type { DeviceService } from "./service.js";

describe("isRuleIndex", () => {
  it("accepts 1, 2, and 3", () => {
    expect(isRuleIndex(1)).toBe(true);
    expect(isRuleIndex(2)).toBe(true);
    expect(isRuleIndex(3)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isRuleIndex(0)).toBe(false);
    expect(isRuleIndex(4)).toBe(false);
    expect(isRuleIndex(1.5)).toBe(false);
  });
});

describe("RuleService", () => {
  function fakeDeviceService(raw: unknown): DeviceService {
    return { sendCommand: vi.fn().mockResolvedValue({ raw }) } as unknown as DeviceService;
  }

  it("parses the Rule<N> response into a normalized RuleState", async () => {
    const deviceService = fakeDeviceService({ Rule1: { Rules: "on Power1#State do X endon", Enabled: true } });
    const rules = new RuleService(deviceService);

    const state = await rules.get(1, 1);

    expect(state).toEqual({ index: 1, rule: "on Power1#State do X endon", enabled: true });
  });

  it("defaults to an empty, disabled rule when the device returns nothing usable", async () => {
    const deviceService = fakeDeviceService({});
    const rules = new RuleService(deviceService);

    const state = await rules.get(1, 2);

    expect(state).toEqual({ index: 2, rule: "", enabled: false });
  });

  it("setRule sends the raw rule text as the command argument", async () => {
    const deviceService = fakeDeviceService({ Rule3: { Rules: "new rule", Enabled: false } });
    const rules = new RuleService(deviceService);

    await rules.setRule(1, 3, "new rule");

    expect(deviceService.sendCommand).toHaveBeenCalledWith(1, "Rule3 new rule");
  });
});
