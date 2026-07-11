import { useEffect } from "react";

import { useStore } from "../store/window-store";

const EPSILON = 0.01;

export const CameraAnimator = () => {
  useEffect(() => {
    let raf = 0;
    let running = false;

    const tick = () => {
      const state = useStore.getState();

      const dx = state.cameraTarget.x - state.camera.x;
      const dy = state.cameraTarget.y - state.camera.y;

      if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
        useStore.setState({
          camera: { x: state.cameraTarget.x, y: state.cameraTarget.y },
        });
        running = false;
        return;
      }

      const ease = 0.15;

      useStore.setState({
        camera: {
          x: state.camera.x + dx * ease,
          y: state.camera.y + dy * ease,
        },
      });

      raf = requestAnimationFrame(tick);
    };

    const unsubscribe = useStore.subscribe((state, prev) => {
      if (!running && state.cameraTarget !== prev.cameraTarget) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
    };
  }, []);

  return null;
};
