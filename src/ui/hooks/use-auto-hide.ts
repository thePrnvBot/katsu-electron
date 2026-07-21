import { useCallback, useEffect, useRef, useState } from "react";

import { AUTO_HIDE_DELAY_MS, SHOW_THROTTLE_MS } from "../lib/constants";

export const useAutoHide = (active: boolean, delay = AUTO_HIDE_DELAY_MS) => {
  const [hidden, setHidden] = useState(false);
  const timer = useRef<number | null>(null);
  const lastShow = useRef(0);

  const startHideTimer = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => {
      if (!active) {
        setHidden(true);
      }
    }, delay);
  }, [active, delay]);

  // Throttled: rapid mousemove events should not each reset the hide timer.
  const show = useCallback(() => {
    const now = Date.now();
    if (now - lastShow.current < SHOW_THROTTLE_MS) {
      return;
    }
    lastShow.current = now;
    setHidden(false);
    startHideTimer();
  }, [startHideTimer]);

  useEffect(() => {
    startHideTimer();
    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
      }
    };
  }, [startHideTimer]);

  return { hidden, show, startHideTimer };
};
