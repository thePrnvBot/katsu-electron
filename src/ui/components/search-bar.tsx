import { ArrowRight, FileUp } from "lucide-react";
import { useState } from "react";

import { useAutoHide } from "../hooks/use-auto-hide";

interface SearchBarProps {
  url: string;
  handleChange: (value: string) => void;
  openSite: () => void;
  onOpenFileDialog: () => void;
}

export const SearchBar = ({
  url,
  handleChange,
  openSite,
  onOpenFileDialog,
}: SearchBarProps) => {
  const [focused, setFocused] = useState(false);
  const { hidden, show, startHideTimer } = useAutoHide(focused);

  const visible = !(hidden && !focused);

  return (
    <div className="fixed left-1/2 top-8 z-40 -translate-x-1/2">
      <div
        onMouseMove={show}
        onMouseEnter={show}
        className={`flex items-center gap-2 rounded-full border border-white/10 bg-[#222] p-2 shadow-lg backdrop-blur-sm transition-transform duration-300 ease-in-out ${
          visible ? "translate-y-2.5" : "-translate-y-full pointer-events-none"
        }`}
      >
        <span className="px-4 pr-2 text-sm text-white/70">Katsu</span>

        <input
          placeholder="Enter a URL..."
          value={url}
          onChange={(e) => {
            handleChange(e.target.value);
            show();
          }}
          onFocus={() => {
            setFocused(true);
            show();
          }}
          onBlur={() => {
            setFocused(false);
            startHideTimer();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              openSite();
            }
            show();
          }}
          className="h-8 w-65 rounded-full bg-[#333] px-4 text-sm text-[#eee] outline-none focus:ring-2 focus:ring-white/25"
        />

        <button
          type="button"
          onClick={() => {
            onOpenFileDialog();
            show();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#444] transition hover:bg-[#555]"
          title="Open local file"
        >
          <FileUp className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            openSite();
            show();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#444] transition hover:bg-[#555]"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div
        onMouseEnter={show}
        className={`absolute left-1/2 top-0 h-3 w-16 -translate-x-1/2 rounded-b-full border border-white/10 border-t-0 bg-[#222] shadow-md shadow-black/30 transition-opacity ${
          hidden && !focused ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
    </div>
  );
};
