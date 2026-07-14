import type { BrowserWindow } from "electron";

let mainWindow: BrowserWindow | null = null;

export const getMainWindow = (): BrowserWindow | null => mainWindow;

export const setMainWindow = (win: BrowserWindow | null): void => {
  mainWindow = win;
};
