import { useEffect } from "react";

import { useStore } from "../store/window-store";

const EPSILON = 0.01;

export const CameraAnimator = () => {
  useEffect(() => {
    let raf = 0;
    let running = false;

    const tick = () => {
      const state = useStore.getState();

      const scale = state.settings.windowPeeking ? 0.9 : 1;
      const targetX = state.cameraTarget.x * scale;
      const targetY = state.cameraTarget.y * scale;

      const dx = targetX - state.camera.x;
      const dy = targetY - state.camera.y;

      if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
        useStore.setState({
          camera: { x: targetX, y: targetY },
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
      if (
        !running &&
        (state.cameraTarget !== prev.cameraTarget ||
          state.settings.windowPeeking !== prev.settings.windowPeeking)
      ) {
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
