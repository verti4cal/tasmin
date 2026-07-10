import { useEffect, useState } from "react";
import { CollapsibleCard } from "../../lib/CollapsibleCard.js";
import { firmwareApi } from "./api.js";
import {
  composeBuildFlags,
  CURATED_BUILD_FLAGS,
  parseBuildFlags,
  type CuratedFlagKey,
} from "./buildFlags.js";
import type { BuildPreset, CreateBuildInput } from "./types.js";

const COMMON_ENVS = [
  "tasmota",
  "tasmota-minimal",
  "tasmota-sensors",
  "tasmota-ir",
  "tasmota-display",
  "tasmota-zbbridge",
];

interface BuildFormProps {
  presets: BuildPreset[];
  onBuildCreated: () => Promise<void>;
  onPresetsChanged: () => Promise<void>;
}

export function BuildForm({ presets, onBuildCreated, onPresetsChanged }: BuildFormProps) {
  const [baseVersion, setBaseVersion] = useState("master");
  const [tags, setTags] = useState<string[]>([]);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [env, setEnv] = useState("tasmota");
  const [overrides, setOverrides] = useState("");
  const [checkedFlags, setCheckedFlags] = useState<Set<CuratedFlagKey>>(new Set());
  const [crystalFrequency, setCrystalFrequency] = useState("");
  const [extraFlags, setExtraFlags] = useState("");
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    firmwareApi
      .listTags()
      .then(setTags)
      .catch((err) =>
        setTagsError(err instanceof Error ? err.message : "Failed to load Tasmota versions"),
      );
  }, []);

  // Always includes the current value (e.g. from a loaded preset) even if it
  // isn't in the fetched tag list, so the select never silently drops it.
  const versionOptions = Array.from(new Set(["master", ...tags, baseVersion]));

  function applyPreset(id: string) {
    setSelectedPresetId(id);
    const preset = presets.find((p) => p.id === Number(id));
    if (!preset) return;
    setBaseVersion(preset.baseVersion);
    setEnv(preset.env);
    setOverrides(preset.overrides);
    const parsed = parseBuildFlags(preset.buildFlags);
    setCheckedFlags(parsed.checked);
    setCrystalFrequency(parsed.crystalFrequency);
    setExtraFlags(parsed.extra);
  }

  function toggleFlag(key: CuratedFlagKey) {
    setCheckedFlags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleDeletePreset() {
    if (!selectedPresetId) return;
    try {
      await firmwareApi.deletePreset(Number(selectedPresetId));
      setSelectedPresetId("");
      await onPresetsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete preset");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const buildFlags = composeBuildFlags({
        checked: checkedFlags,
        crystalFrequency,
        extra: extraFlags,
      });
      const selectedPreset = presets.find((p) => p.id === Number(selectedPresetId));
      const input: CreateBuildInput = {
        baseVersion,
        env,
        overrides,
        buildFlags,
        presetName: selectedPreset?.name,
      };
      await firmwareApi.createBuild(input);
      await onBuildCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue build");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSavePreset() {
    if (!presetName.trim()) return;
    try {
      const buildFlags = composeBuildFlags({
        checked: checkedFlags,
        crystalFrequency,
        extra: extraFlags,
      });
      await firmwareApi.createPreset({
        name: presetName.trim(),
        baseVersion,
        env,
        overrides,
        buildFlags,
      });
      setPresetName("");
      await onPresetsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preset");
    }
  }

  return (
    <CollapsibleCard
      title="New firmware build"
      defaultOpen={false}
      subtitle="Build your custom Tasmota firmware from the GitHub repository."
    >
      <form onSubmit={handleSubmit} className="space-y-2">
        {presets.length > 0 && (
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-sm text-gray-600" htmlFor="preset-select">
                Load preset
              </label>
              <select
                id="preset-select"
                className="border rounded px-2 py-1 text-sm"
                value={selectedPresetId}
                onChange={(e) => applyPreset(e.target.value)}
              >
                <option value="" disabled>
                  Choose a preset…
                </option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleDeletePreset}
              disabled={!selectedPresetId}
              className="px-2 py-1 text-sm border rounded text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Delete preset
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-sm text-gray-600" htmlFor="base-version">
              Tasmota version
            </label>
            <select
              id="base-version"
              className="border rounded px-2 py-1 text-sm"
              value={baseVersion}
              onChange={(e) => setBaseVersion(e.target.value)}
              required
            >
              {versionOptions.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
            {tagsError && <p className="text-xs text-red-600">{tagsError}</p>}
          </div>
          <div>
            <label className="block text-sm text-gray-600" htmlFor="build-env">
              PlatformIO environment
            </label>
            <select
              id="build-env"
              className="border rounded px-2 py-1 text-sm"
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              required
            >
              {COMMON_ENVS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600" htmlFor="overrides">
            user_config_override.h contents (optional)
          </label>
          <textarea
            id="overrides"
            className="w-full border rounded p-2 text-sm font-mono"
            rows={5}
            value={overrides}
            onChange={(e) => setOverrides(e.target.value)}
            placeholder={'#define WIFI_SSID1 "..."\n#define WIFI_PASS1 "..."'}
          />
        </div>

        <div>
          <p className="block text-sm text-gray-600 mb-1">
            PlatformIO build_flags (optional, applied via platformio_override.ini)
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {CURATED_BUILD_FLAGS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={checkedFlags.has(key)}
                  onChange={() => toggleFlag(key)}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            <div>
              <label className="block text-xs text-gray-600" htmlFor="crystal-frequency">
                F_CRYSTAL (Hz, ESP8266)
              </label>
              <input
                id="crystal-frequency"
                className="border rounded px-2 py-1 text-sm"
                value={crystalFrequency}
                onChange={(e) => setCrystalFrequency(e.target.value)}
                placeholder="26000000"
                inputMode="numeric"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-600" htmlFor="extra-flags">
                Additional flags
              </label>
              <input
                id="extra-flags"
                className="w-full border rounded px-2 py-1 text-sm font-mono"
                value={extraFlags}
                onChange={(e) => setExtraFlags(e.target.value)}
                placeholder="-D USE_SCRIPT -D MY_FLAG=1"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="Preset name"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <button
            type="button"
            onClick={handleSavePreset}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Save as preset
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="ml-auto px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {submitting ? "Queuing…" : "Queue build"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </CollapsibleCard>
  );
}
