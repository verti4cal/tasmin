import { useCallback, useEffect, useState } from "react";
import { useOtaEvents } from "../../lib/useOtaEvents.js";
import { devicesApi } from "../devices/api.js";
import type { Device } from "../devices/types.js";
import { firmwareApi } from "../firmware/api.js";
import type { FirmwareBuild } from "../firmware/types.js";
import { otaApi } from "./api.js";

type DeviceOtaStatus = "backing-up" | "pushing" | "verifying" | "success" | "failed";

const STATUS_STYLES: Record<DeviceOtaStatus, string> = {
  "backing-up": "bg-purple-100 text-purple-700",
  pushing: "bg-blue-100 text-blue-700",
  verifying: "bg-yellow-100 text-yellow-700",
  success: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

interface OtaViewProps {
  /** Whether the OTA tab is currently the visible one — this view stays mounted across tab switches (see App.tsx) so devices/builds are refetched each time it becomes active rather than only once on mount. */
  active: boolean;
}

export function OtaView({ active }: OtaViewProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [builds, setBuilds] = useState<FirmwareBuild[]>([]);
  const [selectedBuildId, setSelectedBuildId] = useState("");
  const [pushCompressed, setPushCompressed] = useState(false);
  const [backupFirst, setBackupFirst] = useState(true);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<number>>(new Set());
  const [statuses, setStatuses] = useState<Record<number, { status: DeviceOtaStatus; error?: string }>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadDevices = useCallback(async () => {
    setDevices(await devicesApi.list());
  }, []);

  const reloadBuilds = useCallback(async () => {
    setBuilds(await firmwareApi.listBuilds());
  }, []);

  useEffect(() => {
    if (!active) return;
    reloadDevices();
    reloadBuilds();
    otaApi.status().then((s) => setRunning(s.running));
  }, [active, reloadDevices, reloadBuilds]);

  useOtaEvents((event) => {
    if (event.type === "ota.status") {
      if (event.payload.status === "started") {
        setRunning(true);
      } else {
        setRunning(false);
        void reloadDevices(); // picks up the firmwareVersion bump from successful pushes
      }
    } else if (event.type === "ota.device") {
      setStatuses((prev) => ({
        ...prev,
        [event.payload.deviceId]: { status: event.payload.status, error: event.payload.error },
      }));
    }
  });

  function toggleDevice(id: number) {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedDeviceIds((prev) =>
      prev.size === devices.length ? new Set() : new Set(devices.map((d) => d.id)),
    );
  }

  const successfulBuilds = builds.filter((b) => b.status === "success");
  const selectedBuild = successfulBuilds.find((b) => b.id === Number(selectedBuildId));

  async function handleStart() {
    setError(null);
    if (!selectedBuildId || selectedDeviceIds.size === 0) return;
    setStatuses({});
    try {
      await otaApi.push(Number(selectedBuildId), [...selectedDeviceIds], pushCompressed, backupFirst);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start update");
    }
  }

  return (
    <div className="border rounded p-3 space-y-3">
      <h2 className="font-medium">Update devices</h2>

      <div>
        <label className="block text-sm text-gray-600" htmlFor="ota-build">
          Firmware
        </label>
        <select
          id="ota-build"
          className="w-full max-w-full border rounded px-2 py-1 text-sm"
          value={selectedBuildId}
          onChange={(e) => setSelectedBuildId(e.target.value)}
        >
          <option value="" disabled>
            Choose a firmware…
          </option>
          {successfulBuilds.map((build) => (
            <option key={build.id} value={build.id}>
              {build.env} @ {build.baseVersion} ({build.source}
              {build.presetName ? `, preset: ${build.presetName}` : ""})
            </option>
          ))}
        </select>
        {successfulBuilds.length === 0 && (
          <p className="text-xs text-gray-500 mt-1">
            No compiled or downloaded firmware yet — build or download one on the Firmware tab first.
          </p>
        )}
        {selectedBuild?.binaryGzFilename && (
          <label className="flex items-center gap-1 text-sm text-gray-600 mt-1">
            <input
              type="checkbox"
              checked={pushCompressed}
              onChange={(e) => setPushCompressed(e.target.checked)}
            />
            Upload compressed (.bin.gz) — recommended for low-storage devices
          </label>
        )}
      </div>

      <label className="flex items-center gap-1 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={backupFirst}
          onChange={(e) => setBackupFirst(e.target.checked)}
        />
        Create a config backup of each device before updating
      </label>

      {devices.length === 0 ? (
        <p className="text-gray-500">No devices yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 border rounded text-sm">
          <li className="px-3 py-1.5 flex items-center gap-2 bg-gray-50 text-gray-500">
            <input
              type="checkbox"
              checked={devices.length > 0 && selectedDeviceIds.size === devices.length}
              onChange={toggleAll}
            />
            <span>Select all</span>
          </li>
          {devices.map((device) => {
            const status = statuses[device.id];
            return (
              <li key={device.id} className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedDeviceIds.has(device.id)}
                    onChange={() => toggleDevice(device.id)}
                  />
                  <span className="font-medium">{device.name}</span>
                  <span className="text-gray-500">{device.host}</span>
                  <span className="text-gray-500">{device.firmwareVersion ?? "unknown"}</span>
                  {status && (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[status.status]}`}
                    >
                      {status.status}
                    </span>
                  )}
                  {status?.error && <span className="text-red-600 text-xs">{status.error}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={handleStart}
        disabled={running || !selectedBuildId || selectedDeviceIds.size === 0}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {running ? "Updating…" : "Start update"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
