import { useEffect, useState } from "react";
import { useScanEvents } from "../../lib/useScanEvents.js";
import { scanApi } from "./scanApi.js";

interface ScanFormProps {
  onDeviceAdded: () => Promise<void>;
}

interface DiscoveredDevice {
  id: number;
  name: string;
  host: string;
}

export function ScanForm({ onDeviceAdded }: ScanFormProps) {
  const [subnet, setSubnet] = useState("192.168.1.0/24");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ scanned: number; total: number } | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredDevice[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    scanApi.status().then((s) => setScanning(s.running));
  }, []);

  useScanEvents((event) => {
    if (event.type === "scan.status") {
      if (event.payload.status === "started") {
        setScanning(true);
        setProgress({ scanned: 0, total: event.payload.total });
        setDiscovered([]);
        setSummary(null);
      } else {
        setScanning(false);
        setSummary(
          `Scan complete: ${event.payload.added ?? 0} new device(s) found out of ${event.payload.total} address(es) scanned.`,
        );
        void onDeviceAdded();
      }
    } else if (event.type === "scan.progress") {
      setProgress({ scanned: event.payload.scanned, total: event.payload.total });
    } else if (event.type === "scan.device") {
      setDiscovered((prev) => [...prev, event.payload]);
    }
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await scanApi.start(subnet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start scan");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded p-3 mb-4 space-y-2">
      <h2 className="font-medium">Scan for devices</h2>

      <div className="flex items-end gap-2">
        <div>
          <label className="block text-sm text-gray-600" htmlFor="scan-subnet">
            Subnet (CIDR)
          </label>
          <input
            id="scan-subnet"
            className="border rounded px-2 py-1 text-sm"
            value={subnet}
            onChange={(e) => setSubnet(e.target.value)}
            placeholder="192.168.1.0/24"
            required
          />
        </div>
        <button
          type="submit"
          disabled={scanning}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {scanning ? "Scanning…" : "Scan"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {progress && (
        <div>
          <div className="h-2 bg-gray-200 rounded overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{
                width: `${progress.total === 0 ? 0 : (progress.scanned / progress.total) * 100}%`,
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {progress.scanned} / {progress.total} addresses checked
          </p>
        </div>
      )}

      {discovered.length > 0 && (
        <ul className="text-sm text-gray-700">
          {discovered.map((device) => (
            <li key={device.id}>
              Found: {device.name} ({device.host})
            </li>
          ))}
        </ul>
      )}

      {summary && <p className="text-sm text-gray-700">{summary}</p>}
    </form>
  );
}
