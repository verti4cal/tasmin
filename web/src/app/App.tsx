import { useCallback, useEffect, useState } from "react";
import { DeviceList } from "../features/devices/DeviceList.js";
import { FirmwareView } from "../features/firmware/FirmwareView.js";
import { groupsApi } from "../features/groups/api.js";
import { GroupBar } from "../features/groups/GroupBar.js";
import type { DeviceGroup } from "../features/groups/types.js";
import { OtaView } from "../features/ota/OtaView.js";

type Tab = "devices" | "groups" | "firmware" | "ota";

const TAB_LABELS: Record<Tab, string> = {
  devices: "Devices",
  groups: "Groups",
  firmware: "Firmware",
  ota: "OTA",
};

export function App() {
  const [tab, setTab] = useState<Tab>("devices");
  const [groups, setGroups] = useState<DeviceGroup[]>([]);

  const reloadGroups = useCallback(async () => {
    setGroups(await groupsApi.list());
  }, []);

  useEffect(() => {
    reloadGroups();
  }, [reloadGroups]);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-4">
        <img src="/favicon.svg" alt="" className="w-8 h-8" />
        <h1 className="text-2xl font-semibold">Tasmin</h1>
      </div>

      <nav className="flex gap-2 mb-4 border-b">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      {tab === "devices" && <DeviceList groups={groups} />}
      {tab === "groups" && <GroupBar groups={groups} onGroupsChanged={reloadGroups} />}
      {tab === "firmware" && <FirmwareView />}
      {tab === "ota" && <OtaView />}
    </main>
  );
}
