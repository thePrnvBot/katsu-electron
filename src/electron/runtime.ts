import * as ManagedRuntime from "effect/ManagedRuntime";

import { MainLayer } from "./layers/main-layer.js";

/**
 * Single runtime for the whole main process. Services are resolved once
 * instead of re-providing `MainLayer` at every Effect boundary (which used
 * to happen per network request in the ad-blocking path).
 */
export const mainRuntime = ManagedRuntime.make(MainLayer);
