/** Awaits a promise and swallows rejection for best-effort cleanup. */

export const ignoreFailure = async <T>(
  operation: Promise<T>
): Promise<void> => {
  try {
    await operation;
  } catch {
    // Cleanup operations are best effort.
  }
};
