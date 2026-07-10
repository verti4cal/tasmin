import { useCallback, useEffect, useState } from "react";
import { backupsApi, type ConfigBackup } from "./backupsApi.js";
import { rulesApi, type RuleState } from "./rulesApi.js";
import { Sparkline } from "./Sparkline.js";
import { telemetryApi, type TelemetryPoint } from "./telemetryApi.js";
import type { Device } from "./types.js";

interface DeviceDetailsProps {
  device: Device;
}

const RULE_INDEXES = [1, 2, 3] as const;

export function DeviceDetails({ device }: DeviceDetailsProps) {
  return (
    <div className="mt-3 space-y-4 border-t pt-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <RuleEditor deviceId={device.id} />
        <BackupManager deviceId={device.id} />
      </div>
      <HistoryPanel deviceId={device.id} />
    </div>
  );
}

function RuleEditor({ deviceId }: { deviceId: number }) {
  const [index, setIndex] = useState<(typeof RULE_INDEXES)[number]>(1);
  const [state, setState] = useState<RuleState | null>(null);
  const [ruleText, setRuleText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await rulesApi.get(deviceId, index);
      setState(result);
      setRuleText(result.rule);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rule");
    } finally {
      setLoading(false);
    }
  }, [deviceId, index]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setError(null);
    try {
      const result = await rulesApi.update(deviceId, index, { rule: ruleText });
      setState(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rule");
    }
  }

  async function handleToggleEnabled() {
    if (!state) return;
    setError(null);
    try {
      const result = await rulesApi.update(deviceId, index, { enabled: !state.enabled });
      setState(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update rule");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-sm">Rules</h3>
        <select
          className="text-sm border rounded px-1 py-0.5"
          value={index}
          onChange={(e) => setIndex(Number(e.target.value) as (typeof RULE_INDEXES)[number])}
        >
          {RULE_INDEXES.map((i) => (
            <option key={i} value={i}>
              Rule{i}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && (
        <>
          <textarea
            className="w-full border rounded p-2 text-sm font-mono"
            rows={4}
            value={ruleText}
            onChange={(e) => setRuleText(e.target.value)}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleSave}
              className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
            >
              Save rule
            </button>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={state?.enabled ?? false}
                onChange={handleToggleEnabled}
              />
              Enabled
            </label>
          </div>
        </>
      )}
    </div>
  );
}

function BackupManager({ deviceId }: { deviceId: number }) {
  const [backups, setBackups] = useState<ConfigBackup[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBackups(await backupsApi.list(deviceId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load backups");
    }
  }, [deviceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      await backupsApi.create(deviceId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(backup: ConfigBackup) {
    setBusy(true);
    setError(null);
    try {
      await backupsApi.restore(deviceId, backup.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(backup: ConfigBackup) {
    await backupsApi.remove(deviceId, backup.id);
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-sm">Config backups</h3>
        <button
          onClick={handleCreate}
          disabled={busy}
          className="px-2 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? "Working…" : "Create backup"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {backups.length === 0 && <p className="text-sm text-gray-500">No backups yet.</p>}

      <ul className="space-y-1">
        {backups.map((backup) => (
          <li key={backup.id} className="flex items-center justify-between text-sm">
            <span className="truncate">
              {backup.filename} ({Math.round(backup.sizeBytes / 1024)} KB)
            </span>
            <span className="flex gap-2">
              <a
                href={backupsApi.downloadUrl(deviceId, backup.id)}
                className="px-2 py-0.5 border rounded hover:bg-gray-50"
              >
                Download
              </a>
              <button
                onClick={() => handleRestore(backup)}
                disabled={busy}
                className="px-2 py-0.5 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Restore
              </button>
              <button
                onClick={() => handleDelete(backup)}
                className="px-2 py-0.5 border rounded text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryPanel({ deviceId }: { deviceId: number }) {
  const [keys, setKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [points, setPoints] = useState<TelemetryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    telemetryApi
      .keys(deviceId)
      .then((result) => {
        setKeys(result);
        setSelectedKey((current) => current || result[0] || "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load telemetry keys"));
  }, [deviceId]);

  useEffect(() => {
    if (!selectedKey) return;
    telemetryApi
      .history(deviceId, selectedKey, 24)
      .then(setPoints)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load history"));
  }, [deviceId, selectedKey]);

  if (keys.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-sm">History (last 24h)</h3>
        <select
          className="text-sm border rounded px-1 py-0.5"
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
        >
          {keys.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Sparkline points={points} />
    </div>
  );
}
