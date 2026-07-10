import { useEffect, useState } from "react";
import { CollapsibleCard } from "../../lib/CollapsibleCard.js";
import { firmwareApi } from "./api.js";
import type { PrebuiltVariant } from "./types.js";

interface PrebuiltDownloadFormProps {
  onDownloaded: () => Promise<void>;
}

export function PrebuiltDownloadForm({ onDownloaded }: PrebuiltDownloadFormProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [version, setVersion] = useState("");
  const [variants, setVariants] = useState<PrebuiltVariant[]>([]);
  const [variant, setVariant] = useState("");
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    firmwareApi
      .listTags()
      .then((result) => {
        setTags(result);
        setVersion((prev) => prev || result[0] || "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load versions"));
  }, []);

  useEffect(() => {
    if (!version) return;
    setLoadingVariants(true);
    setError(null);
    firmwareApi
      .listPrebuiltVariants(version)
      .then((result) => {
        setVariants(result);
        setVariant(result[0]?.variant ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load variants"))
      .finally(() => setLoadingVariants(false));
  }, [version]);

  async function handleDownload() {
    if (!version || !variant) return;
    setDownloading(true);
    setError(null);
    try {
      await firmwareApi.downloadPrebuilt(version, variant);
      await onDownloaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <CollapsibleCard
      title="Download prebuilt firmware"
      defaultOpen={false}
      subtitle="Official binaries from Tasmota's GitHub releases — no local compile needed."
    >
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm text-gray-600" htmlFor="prebuilt-version">
            Tasmota version
          </label>
          <select
            id="prebuilt-version"
            className="border rounded px-2 py-1 text-sm"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          >
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600" htmlFor="prebuilt-variant">
            Variant
          </label>
          <select
            id="prebuilt-variant"
            className="border rounded px-2 py-1 text-sm"
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
            disabled={loadingVariants || variants.length === 0}
          >
            {variants.map((v) => (
              <option key={v.variant} value={v.variant}>
                {v.variant} ({Math.round(v.sizeBytes / 1024)} KB)
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading || !variant}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {downloading ? "Downloading…" : "Download"}
        </button>
      </div>

      {loadingVariants && <p className="text-xs text-gray-500">Loading variants…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </CollapsibleCard>
  );
}
