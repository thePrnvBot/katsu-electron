import { useCallback, useEffect, useRef, useState } from "react";

export const useAutoHide = (active: boolean, delay = 2500) => {
  const [hidden, setHidden] = useState(false);
  const timer = useRef<number | null>(null);

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

  const show = useCallback(() => {
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
