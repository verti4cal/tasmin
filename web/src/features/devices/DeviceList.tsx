import { useCallback, useEffect, useState } from "react";
import { useDeviceEvents } from "../../lib/useDeviceEvents.js";
import type { DeviceGroup } from "../groups/types.js";
import { devicesApi } from "./api.js";
import { DeviceDetails } from "./DeviceDetails.js";
import { getPowerState, getRssi } from "./state.js";
import { ScanForm } from "./ScanForm.js";
import type { Device } from "./types.js";

interface DeviceListProps {
  groups: DeviceGroup[];
}

export function DeviceList({ groups }: DeviceListProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setDevices(await devicesApi.list());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useDeviceEvents((event) => {
    setDevices((prev) =>
      prev.map((device) =>
        device.id === event.payload.deviceId
          ? { ...device, state: { ...device.state, [event.payload.key]: event.payload.value } }
          : device,
      ),
    );
  });

  async function handleToggle(device: Device) {
    setActionError(null);
    setPendingId(device.id);
    try {
      await devicesApi.sendCommand(device.id, "Power Toggle");
    } catch (err) {
      setActionError(
        `Failed to toggle ${device.name}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setPendingId(null);
    }
  }

  async function handleRemove(device: Device) {
    setActionError(null);
    try {
      await devicesApi.remove(device.id);
      await reload();
    } catch (err) {
      setActionError(
        `Failed to remove ${device.name}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  async function handleGroupChange(device: Device, groupId: string) {
    setActionError(null);
    try {
      await devicesApi.update(device.id, { groupId: groupId ? Number(groupId) : null });
      await reload();
    } catch (err) {
      setActionError(
        `Failed to update ${device.name}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  return (
    <div>
      <ScanForm onDeviceAdded={reload} />

      {loading && <p className="text-gray-500">Loading devices…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {actionError && <p className="text-red-600 mb-2">{actionError}</p>}

      {!loading && devices.length === 0 && (
        <p className="text-gray-500">No devices yet — scan a subnet above.</p>
      )}

      <ul className="divide-y divide-gray-200 border rounded">
        {devices.map((device) => {
          const power = getPowerState(device.state);
          const rssi = getRssi(device.state);
          const isExpanded = expandedId === device.id;

          return (
            <li key={device.id} className="px-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{device.name}</p>
                  <p className="text-sm text-gray-500">{device.host}</p>
                </div>
                <div className="flex items-center gap-3">
                  {power && (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        power === "ON"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {power}
                    </span>
                  )}
                  {rssi !== undefined && (
                    <span className="text-xs text-gray-500">RSSI {rssi}%</span>
                  )}
                  <select
                    className="text-sm border rounded px-1 py-0.5"
                    value={device.groupId ?? ""}
                    onChange={(e) => handleGroupChange(device, e.target.value)}
                  >
                    <option value="">No group</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleToggle(device)}
                    disabled={pendingId === device.id}
                    className="px-2 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    {pendingId === device.id ? "Sending…" : "Toggle power"}
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : device.id)}
                    className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                  >
                    {isExpanded ? "Hide details" : "Details"}
                  </button>
                  <button
                    onClick={() => handleRemove(device)}
                    className="px-2 py-1 text-sm border rounded text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {isExpanded && <DeviceDetails device={device} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
