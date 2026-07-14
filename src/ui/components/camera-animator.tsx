import { useEffect } from "react";

import { useCameraStore } from "../store/camera-store";

const EPSILON = 0.01;
const EASE = 0.15;

export const CameraAnimator = () => {
  useEffect(() => {
    let raf = 0;
    let running = false;

    const tick = () => {
      const state = useCameraStore.getState();

      const dx = state.cameraTarget.x - state.camera.x;
      const dy = state.cameraTarget.y - state.camera.y;

      if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
        useCameraStore.setState({
          camera: { x: state.cameraTarget.x, y: state.cameraTarget.y },
        });
        running = false;
        return;
      }

      useCameraStore.setState({
        camera: {
          x: state.camera.x + dx * EASE,
          y: state.camera.y + dy * EASE,
        },
      });

      raf = requestAnimationFrame(tick);
    };

    const unsubscribe = useCameraStore.subscribe((state, prev) => {
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
