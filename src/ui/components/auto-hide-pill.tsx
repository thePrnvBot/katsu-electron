interface AutoHidePillProps {
  hidden: boolean;
  onShow: () => void;
  position: "top" | "bottom";
}

/**
 * Small rounded pill that peeks out from an edge when its host is hidden,
 * so the user can hover to reveal again.
 */
export const AutoHidePill = ({
  hidden,
  onShow,
  position,
}: AutoHidePillProps) => {
  const positionClasses =
    position === "top"
      ? "left-1/2 top-0 -translate-x-1/2 rounded-b-full border-t-0"
      : "left-1/2 bottom-0 -translate-x-1/2 rounded-t-full border-b-0";
  return (
    <div
      onMouseEnter={onShow}
      className={`absolute h-3 w-16 border border-white/10 bg-[#222] shadow-md shadow-black/30 transition-opacity ${positionClasses} ${
        hidden ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    />
  );
};
