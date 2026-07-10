import { useState } from "react";
import { groupsApi } from "./api.js";
import type { DeviceGroup } from "./types.js";

interface GroupBarProps {
  groups: DeviceGroup[];
  onGroupsChanged: () => Promise<void>;
}

export function GroupBar({ groups, onGroupsChanged }: GroupBarProps) {
  const [newGroupName, setNewGroupName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newGroupName.trim()) return;
    await groupsApi.create(newGroupName.trim());
    setNewGroupName("");
    await onGroupsChanged();
  }

  async function handleDelete(group: DeviceGroup) {
    await groupsApi.remove(group.id);
    await onGroupsChanged();
  }

  async function handleBulkCommand(group: DeviceGroup, command: string) {
    const results = await groupsApi.sendCommand(group.id, command);
    const failed = results.filter((r) => !r.ok);
    setFeedback(
      failed.length === 0
        ? `${group.name}: sent "${command}" to ${results.length} device(s).`
        : `${group.name}: ${failed.length}/${results.length} device(s) failed — ${failed
            .map((f) => f.deviceName)
            .join(", ")}`,
    );
  }

  return (
    <div className="mb-6 border rounded p-3">
      <h2 className="font-medium mb-2">Groups</h2>

      <form onSubmit={handleCreate} className="flex gap-2 mb-3">
        <input
          className="border rounded px-2 py-1 text-sm"
          placeholder="New group name"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
        />
        <button type="submit" className="px-2 py-1 text-sm border rounded hover:bg-gray-50">
          Add group
        </button>
      </form>

      {groups.length === 0 && <p className="text-sm text-gray-500">No groups yet.</p>}

      <ul className="space-y-1">
        {groups.map((group) => (
          <li key={group.id} className="flex items-center gap-2 text-sm">
            <span className="font-medium">{group.name}</span>
            <button
              onClick={() => handleBulkCommand(group, "Power On")}
              className="px-2 py-0.5 border rounded hover:bg-gray-50"
            >
              All On
            </button>
            <button
              onClick={() => handleBulkCommand(group, "Power Off")}
              className="px-2 py-0.5 border rounded hover:bg-gray-50"
            >
              All Off
            </button>
            <button
              onClick={() => handleDelete(group)}
              className="px-2 py-0.5 border rounded text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {feedback && <p className="text-sm text-gray-600 mt-2">{feedback}</p>}
    </div>
  );
}
