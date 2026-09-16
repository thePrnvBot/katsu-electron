/** Provider dropdown with brand logos (native `<option>` cannot show images). */

/* eslint-disable jsx-a11y/prefer-tag-over-role -- custom listbox renders logos */

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type {
  ArtifactProviderId,
  ArtifactProviderSummary,
} from "../../shared/contract";
import { Z_COMMAND_MENU } from "../lib/constants";
import { ProviderLogo } from "./provider-logo";

interface ProviderSelectProps {
  providers: readonly ArtifactProviderSummary[];
  value: ArtifactProviderId;
  onChange: (id: ArtifactProviderId) => void;
}

interface MenuPosition {
  readonly left: number;
  readonly top: number;
}

const MENU_WIDTH = 208;
const MENU_GAP = 4;
const MENU_EDGE = 8;
const MENU_ITEM_HEIGHT = 40;

/** Absolute overlay position, flipped above the trigger when it won't fit. */
const computeMenuPosition = (
  trigger: DOMRect,
  itemCount: number
): MenuPosition => {
  const menuHeight = itemCount * MENU_ITEM_HEIGHT + MENU_GAP;
  const fitsBelow =
    trigger.bottom + MENU_GAP + menuHeight <= window.innerHeight - MENU_EDGE;
  return {
    left: Math.max(MENU_EDGE, trigger.right - MENU_WIDTH),
    top: fitsBelow
      ? trigger.bottom + MENU_GAP
      : Math.max(MENU_EDGE, trigger.top - menuHeight - MENU_GAP),
  };
};

export const ProviderSelect = ({
  providers,
  value,
  onChange,
}: ProviderSelectProps) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = providers.find((provider) => provider.id === value);

  useEffect(() => {
    if (!open) {
      return;
    }
    // The menu is portaled, so it must reposition with its trigger and close
    // when the palette scrolls out from under it.
    const close = () => {
      setOpen(false);
    };
    const onMouseDown = (event: MouseEvent) => {
      const { target } = event;
      if (
        target instanceof Node &&
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Capture phase: the palette dialog pops its page stack on Escape
        // from a React handler that runs before bubble-phase document
        // listeners, so stopping here is the only way to keep this Escape
        // for closing the menu alone.
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const openMenu = () => {
    const trigger = triggerRef.current?.getBoundingClientRect();
    if (trigger) {
      setMenuPosition(computeMenuPosition(trigger, providers.length));
    }
    const index = providers.findIndex((provider) => provider.id === value);
    setHighlight(Math.max(0, index));
    setOpen(true);
  };

  const choose = (id: ArtifactProviderId) => {
    onChange(id);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "ArrowDown"
      ) {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.min(providers.length - 1, current + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const provider = providers[highlight];
      if (provider) {
        choose(provider.id);
      }
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Provider"
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openMenu();
          }
        }}
        onKeyDown={handleKeyDown}
        className="flex h-24 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-white/5 bg-[#2a2a2a] px-2 text-sm text-[#eee] outline-none transition hover:border-white/10 focus:border-white/15"
      >
        {selected ? (
          <ProviderLogo id={selected.id} size={44} />
        ) : (
          <span className="w-full truncate text-center">{value}</span>
        )}
        <ChevronDown
          className={`shrink-0 text-white/40 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          size={18}
        />
      </button>

      {open &&
        menuPosition &&
        createPortal(
          // A native <select> cannot render the provider logos, so this is a
          // custom listbox.
          <div
            ref={menuRef}
            aria-label="Provider"
            className="fixed flex flex-col gap-0.5 rounded-lg border border-white/10 bg-[#242424] p-1 shadow-2xl shadow-black/60"
            role="listbox"
            style={{
              left: menuPosition.left,
              top: menuPosition.top,
              width: MENU_WIDTH,
              zIndex: Z_COMMAND_MENU + 1,
            }}
          >
            {providers.length === 0 && (
              <div className="px-2.5 py-2 text-xs text-white/40">
                No providers found
              </div>
            )}
            {providers.map((provider, index) => (
              <div
                key={provider.id}
                aria-selected={provider.id === value}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm transition ${
                  index === highlight ? "bg-white/10" : ""
                } ${provider.available ? "text-white/90" : "text-white/40"}`}
                onClick={() => choose(provider.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    choose(provider.id);
                  }
                }}
                onMouseEnter={() => setHighlight(index)}
                role="option"
                tabIndex={-1}
              >
                <ProviderLogo id={provider.id} />
                <span className="min-w-0 flex-1 truncate">
                  {provider.label}
                </span>
                {provider.id === value && (
                  <Check className="shrink-0 text-green-400" size={14} />
                )}
                {provider.available ? null : (
                  <span className="shrink-0 text-[10px] text-white/30">
                    not installed
                  </span>
                )}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};
