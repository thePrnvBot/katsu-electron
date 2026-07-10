import { ArrowRight, FileUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const HIDE_DELAY = 2500;

interface SearchBarProps {
  url: string;
  handleChange: (value: string) => void;
  openSite: () => void;
  onOpenFileDialog: () => void;
}

export function SearchBar({
  url,
  handleChange,
  openSite,
  onOpenFileDialog,
}: SearchBarProps) {
  const [hidden, setHidden] = useState(false);
  const [focused, setFocused] = useState(false);
  const timer = useRef<number | null>(null);

  const startHideTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!focused) setHidden(true);
    }, HIDE_DELAY);
  }, [focused]);

  const show = () => {
    setHidden(false);
    startHideTimer();
  };

  useEffect(() => {
    startHideTimer();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [startHideTimer]);

  const visible = !(hidden && !focused);

  return (
    <div className="fixed left-1/2 top-8 z-40 -translate-x-1/2">
      <div
        onMouseMove={show}
        onMouseEnter={show}
        className={`flex items-center gap-2 rounded-full border border-white/10 bg-[#222] p-2 shadow-lg backdrop-blur-sm transition-transform duration-300 ease-in-out ${
          visible
            ? "translate-y-2.5"
            : "-translate-y-full pointer-events-none"
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
            setHidden(false);
          }}
          onBlur={() => {
            setFocused(false);
            startHideTimer();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") openSite();
            show();
          }}
          className="h-8 w-65 rounded-full bg-[#333] px-4 text-sm text-[#eee] outline-none focus:ring-2 focus:ring-white/25"
        />

        <button
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
}
