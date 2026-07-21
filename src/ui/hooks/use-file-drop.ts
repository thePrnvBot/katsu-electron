import { useCallback, useRef, useState } from "react";

interface UseFileDropOptions {
  onFileDrop: (files: File[]) => void;
}

interface UseFileDropReturn {
  dragOver: boolean;
  dragHandlers: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

export const useFileDrop = ({
  onFileDrop,
}: UseFileDropOptions): UseFileDropReturn => {
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    setDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragOver(false);
      const files = [...e.dataTransfer.files];
      if (files.length > 0) {
        onFileDrop(files);
      }
    },
    [onFileDrop]
  );

  return {
    dragHandlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
    dragOver,
  };
};
