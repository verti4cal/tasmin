import { useCallback, useEffect, useRef, useState } from "react";
import { devicesApi } from "../devices/api.js";
import type { Device } from "../devices/types.js";
import { useBuildEvents } from "../../lib/useBuildEvents.js";
import { firmwareApi } from "./api.js";
import type { FirmwareBuild } from "./types.js";

interface BuildListProps {
  builds: FirmwareBuild[];
  onBuildsChanged: () => Promise<void>;
}

const STATUS_STYLES: Record<FirmwareBuild["status"], string> = {
  queued: "bg-gray-100 text-gray-600",
  building: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export function BuildList({ builds, onBuildsChanged }: BuildListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<number, FirmwareBuild["status"]>>({});

  useBuildEvents((event) => {
    if (event.type === "build.status") {
      setStatusOverrides((prev) => ({ ...prev, [event.payload.buildId]: event.payload.status as FirmwareBuild["status"] }));
      if (event.payload.status === "success" || event.payload.status === "failed") {
        void onBuildsChanged();
      }
    }
  });

  async function handleDelete(build: FirmwareBuild) {
    await firmwareApi.deleteBuild(build.id);
    await onBuildsChanged();
  }

  if (builds.length === 0) {
    return <p className="text-gray-500">No builds yet — queue one above.</p>;
  }

  return (
    <ul className="divide-y divide-gray-200 border rounded">
      {builds.map((build) => {
        const status = statusOverrides[build.id] ?? build.status;
        const isExpanded = expandedId === build.id;

        return (
          <li key={build.id} className="px-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {build.env} <span className="text-gray-500 font-normal">@ {build.baseVersion}</span>
                </p>
                <p className="text-xs text-gray-500">{build.createdAt}</p>
              </div>
              <div className="flex flex-col items-end gap-2 ml-auto">
                <div className="flex flex-wrap items-center gap-2">
                  {build.presetName && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      preset: {build.presetName}
                    </span>
                  )}
                  {build.source === "prebuilt" && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      prebuilt
                    </span>
                  )}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
                    {status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : build.id)}
                    className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                  >
                    {isExpanded ? "Hide details" : "Details"}
                  </button>
                  <button
                    onClick={() => handleDelete(build)}
                    className="px-2 py-1 text-sm border rounded text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            {isExpanded && <BuildDetails build={{ ...build, status }} />}
          </li>
        );
      })}
    </ul>
  );
}

const SCROLL_BOTTOM_THRESHOLD_PX = 20;

function BuildDetails({ build }: { build: FirmwareBuild }) {
  const [log, setLog] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [pushCompressed, setPushCompressed] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLPreElement>(null);

  const isPrebuilt = build.source === "prebuilt";

  const loadLog = useCallback(async () => {
    if (isPrebuilt) return;
    setLog(await firmwareApi.getLog(build.id));
  }, [build.id, isPrebuilt]);

  useEffect(() => {
    loadLog();
    devicesApi.list().then(setDevices);
  }, [loadLog]);

  useBuildEvents((event) => {
    if (event.type === "build.log" && event.payload.buildId === build.id) {
      setLog((prev) => `${prev}${event.payload.line}\n`);
    }
  });

  useEffect(() => {
    const el = logRef.current;
    if (autoScroll && el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [log, autoScroll]);

  function handleLogScroll() {
    const el = logRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD_PX);
  }

  async function handlePush() {
    if (!selectedDeviceId) return;
    setPushStatus("Pushing… (device reboots and we verify the new version — can take up to a minute)");
    try {
      await firmwareApi.pushToDevice(build.id, Number(selectedDeviceId), pushCompressed);
      setPushStatus("Pushed.");
    } catch (err) {
      setPushStatus(err instanceof Error ? err.message : "Push failed");
    }
  }

  return (
    <div className="mt-3 border-t pt-3">
      {isPrebuilt ? (
        <p className="text-sm text-gray-500">
          Downloaded directly from Tasmota's GitHub releases — no compile log.
        </p>
      ) : (
        <div className="relative">
          <pre
            ref={logRef}
            onScroll={handleLogScroll}
            className="bg-gray-900 text-gray-100 text-xs p-3 rounded max-h-64 overflow-auto whitespace-pre-wrap"
          >
            {log || "(no log yet)"}
          </pre>
          {!autoScroll && (
            <button
              type="button"
              onClick={() => setAutoScroll(true)}
              className="absolute bottom-2 right-2 px-2 py-0.5 text-xs bg-gray-700 text-gray-100 rounded hover:bg-gray-600"
            >
              Resume auto-scroll
            </button>
          )}
        </div>
      )}

      {build.errorMessage && <p className="text-sm text-red-600 mt-2">{build.errorMessage}</p>}

      {build.status === "success" && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <a
            href={firmwareApi.downloadUrl(build.id)}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Download binary
          </a>
          {build.binaryGzFilename && (
            <a
              href={firmwareApi.downloadUrl(build.id, true)}
              className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
            >
              Download .gz
            </a>
          )}
          <select
            className="text-sm border rounded px-1 py-0.5"
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
          >
            <option value="">Push to device…</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
          {build.binaryGzFilename && (
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={pushCompressed}
                onChange={(e) => setPushCompressed(e.target.checked)}
              />
              compressed
            </label>
          )}
          <button
            onClick={handlePush}
            disabled={!selectedDeviceId}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Push
          </button>
          {pushStatus && <span className="text-sm text-gray-600">{pushStatus}</span>}
        </div>
      )}
    </div>
  );
}
