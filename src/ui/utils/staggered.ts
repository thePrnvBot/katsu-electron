/** Staggered timers with cancellation, shared by restore and workspace hydration. */

/** Timers of an in-flight staggered pass so a new pass can cancel them. */
const pendingTimers: number[] = [];

/** Cancel any in-flight staggered pass. */
export const cancelStaggered = (): void => {
  for (const timer of pendingTimers.splice(0)) {
    window.clearTimeout(timer);
  }
};

/**
 * Run `apply` for each entry one at a time, `delayMs` apart, so a burst of
 * webview/PTY mounts never stalls the renderer. A new call cancels the
 * previous pass.
 */
export const scheduleStaggered = <T>(
  entries: readonly T[],
  apply: (entry: T) => void,
  delayMs: number
): void => {
  cancelStaggered();
  for (const [index, entry] of entries.entries()) {
    pendingTimers.push(
      window.setTimeout(() => {
        apply(entry);
      }, index * delayMs)
    );
  }
};
