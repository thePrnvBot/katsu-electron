import { Command } from "cmdk";
import { Check } from "lucide-react";
import { useCameraStore } from "../../store/camera-store";
import { useSettingsStore } from "../../store/settings-store";
import type { CloseProps } from "./command-menu";

export const SettingsMenu = ({ closeAndResetMenu }: CloseProps) => {
  const settings = useSettingsStore((s) => s.settings);
  const toggleWindowPeeking = useSettingsStore((s) => s.toggleWindowPeeking);
  const toggleKeepWindowsAlive = useSettingsStore(
    (s) => s.toggleKeepWindowsAlive
  );
  const refreshGridSize = useCameraStore((s) => s.refreshGridSize);

  return (
    <>
      <Command.Item
        onSelect={() => {
          toggleWindowPeeking();
          closeAndResetMenu();
        }}
        className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-[#eee] outline-none data-[selected=true]:bg-[#333]"
      >
        <span>Window Peeking</span>
        {settings.windowPeeking && <Check className="h-4 w-4 text-green-400" />}
      </Command.Item>
      <Command.Item
        onSelect={() => {
          toggleKeepWindowsAlive();
          closeAndResetMenu();
        }}
        className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-[#eee] outline-none data-[selected=true]:bg-[#333]"
      >
        <span>Keep Windows Alive</span>
        {settings.keepWindowsAlive && (
          <Check className="h-4 w-4 text-green-400" />
        )}
      </Command.Item>
      <Command.Item
        onSelect={() => {
          refreshGridSize();
          closeAndResetMenu();
        }}
        className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-[#eee] outline-none data-[selected=true]:bg-[#333]"
      >
        Refresh Grid Size
      </Command.Item>
    </>
  );
};
