/**
 * Curated from Tasmota's own platformio_override_sample.ini — the
 * documented set of build_flags people commonly add via
 * platformio_override.ini's [tasmota] section (applied to every
 * environment, independent of user_config_override.h defines).
 */
export const CURATED_BUILD_FLAGS = [
  { key: "debugCore", flag: "-D DEBUG_TASMOTA_CORE", label: "Debug: core" },
  { key: "debugDriver", flag: "-D DEBUG_TASMOTA_DRIVER", label: "Debug: drivers" },
  { key: "debugSensor", flag: "-D DEBUG_TASMOTA_SENSOR", label: "Debug: sensors" },
  { key: "ummStatsFull", flag: "-D UMM_STATS_FULL", label: "ESP8266 heap stats (UMM_STATS_FULL)" },
  {
    key: "ummInlineMetrics",
    flag: "-D UMM_INLINE_METRICS",
    label: "ESP8266 inline heap metrics (UMM_INLINE_METRICS)",
  },
  { key: "noSwitchWarning", flag: "-Wno-switch-unreachable", label: "Suppress switch-unreachable warning" },
] as const;

export type CuratedFlagKey = (typeof CURATED_BUILD_FLAGS)[number]["key"];

export interface BuildFlagsSelection {
  checked: Set<CuratedFlagKey>;
  crystalFrequency: string;
  extra: string;
}

/** Combines the curated selection back into the single string persisted server-side. */
export function composeBuildFlags(selection: BuildFlagsSelection): string {
  const parts: string[] = [];
  for (const { key, flag } of CURATED_BUILD_FLAGS) {
    if (selection.checked.has(key)) parts.push(flag);
  }
  if (selection.crystalFrequency.trim()) {
    parts.push(`-D F_CRYSTAL=${selection.crystalFrequency.trim()}`);
  }
  if (selection.extra.trim()) {
    parts.push(selection.extra.trim());
  }
  return parts.join(" ");
}

/** Reconstructs the curated selection from a persisted flags string (e.g. loaded from a preset). */
export function parseBuildFlags(raw: string): BuildFlagsSelection {
  let remaining = raw;
  const checked = new Set<CuratedFlagKey>();

  for (const { key, flag } of CURATED_BUILD_FLAGS) {
    if (remaining.includes(flag)) {
      checked.add(key);
      remaining = remaining.replace(flag, "").trim();
    }
  }

  let crystalFrequency = "";
  const crystalMatch = remaining.match(/-D F_CRYSTAL=(\S+)/);
  if (crystalMatch?.[1]) {
    crystalFrequency = crystalMatch[1];
    remaining = remaining.replace(crystalMatch[0], "").trim();
  }

  return { checked, crystalFrequency, extra: remaining.replace(/\s+/g, " ").trim() };
}
