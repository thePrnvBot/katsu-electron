/** Palette page saving and loading named workspaces. */

import { Command } from "cmdk";
import { useEffect, useState } from "react";

import { useWorkspaceLibrary } from "../../store/workspace-library-store";
import {
  deleteWorkspaceByName,
  loadWorkspaceByName,
  saveCurrentWorkspace,
} from "../../utils/workspace-actions";
import type { CloseProps } from "./command-menu";

interface WorkspaceMenuProps extends CloseProps {
  search: string;
}

export const WorkspaceMenu = ({
  closeAndResetMenu,
  search,
}: WorkspaceMenuProps) => {
  const workspaces = useWorkspaceLibrary((s) => s.workspaces);
  const refreshWorkspaces = useWorkspaceLibrary((s) => s.refresh);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  // The menu-wide filter is disabled on this page because the search box
  // doubles as the save name — the load list is filtered manually instead.
  const saveName = search.trim();
  const query = saveName.toLowerCase();
  const filtered = workspaces.filter((workspace) =>
    workspace.name.toLowerCase().includes(query)
  );
  const exactMatch = workspaces.find(
    (workspace) => workspace.name === saveName
  );

  const handleSave = async () => {
    const failure = await saveCurrentWorkspace(saveName);
    if (failure !== null) {
      setError(failure);
      return;
    }
    await refreshWorkspaces();
  };

  const handleLoad = async (name: string) => {
    const failure = await loadWorkspaceByName(name);
    if (failure !== null) {
      setError(failure);
      return;
    }
    closeAndResetMenu();
  };

  const handleDelete = async (name: string) => {
    const failure = await deleteWorkspaceByName(name);
    if (failure !== null) {
      setError(failure);
      return;
    }
    await refreshWorkspaces();
  };

  return (
    <>
      {error && (
        <output className="block px-3 pb-1 text-xs text-red-400/80">
          {error}
        </output>
      )}
      {saveName.length > 0 && !exactMatch && (
        <Command.Item
          onSelect={() => {
            void handleSave();
          }}
          value={`save:${saveName}`}
          className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-[#eee] outline-none data-[selected=true]:bg-[#333]"
        >
          Save &ldquo;{saveName}&rdquo;
        </Command.Item>
      )}
      {exactMatch && (
        <Command.Item
          onSelect={() => {
            void handleDelete(exactMatch.name);
          }}
          value={`delete:${exactMatch.name}`}
          className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-red-400/90 outline-none data-[selected=true]:bg-[#333]"
        >
          Delete &ldquo;{exactMatch.name}&rdquo;
        </Command.Item>
      )}
      {filtered.map((workspace) => (
        <Command.Item
          key={workspace.name}
          onSelect={() => {
            void handleLoad(workspace.name);
          }}
          value={workspace.name}
          className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-[#eee] outline-none data-[selected=true]:bg-[#333]"
        >
          <span className="min-w-0 truncate">{workspace.name}</span>
        </Command.Item>
      ))}
      {workspaces.length === 0 && saveName.length === 0 && (
        <div className="px-3 py-2 text-sm text-white/40">
          No workspaces yet.
        </div>
      )}
    </>
  );
};
