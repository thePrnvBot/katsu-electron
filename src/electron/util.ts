import path from "node:path";

import { app } from "electron";

export const isDev = (): boolean => process.env.NODE_ENV === "development";

export function getUserData(userDataFile: string): string {
  return path.join(app.getPath("userData"), userDataFile);
}
