import { useCallback, useEffect, useState } from "react";
import { firmwareApi } from "./api.js";
import { BuildForm } from "./BuildForm.js";
import { BuildList } from "./BuildList.js";
import { PrebuiltDownloadForm } from "./PrebuiltDownloadForm.js";
import type { BuildPreset, FirmwareBuild } from "./types.js";

export function FirmwareView() {
  const [builds, setBuilds] = useState<FirmwareBuild[]>([]);
  const [presets, setPresets] = useState<BuildPreset[]>([]);

  const reloadBuilds = useCallback(async () => {
    setBuilds(await firmwareApi.listBuilds());
  }, []);

  const reloadPresets = useCallback(async () => {
    setPresets(await firmwareApi.listPresets());
  }, []);

  useEffect(() => {
    reloadBuilds();
    reloadPresets();
  }, [reloadBuilds, reloadPresets]);

  return (
    <div>
      <PrebuiltDownloadForm onDownloaded={reloadBuilds} />
      <BuildForm presets={presets} onBuildCreated={reloadBuilds} onPresetsChanged={reloadPresets} />
      <BuildList builds={builds} onBuildsChanged={reloadBuilds} />
    </div>
  );
}
