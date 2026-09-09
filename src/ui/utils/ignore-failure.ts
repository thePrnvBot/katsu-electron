export const ignoreFailure = async <T>(
  operation: Promise<T>
): Promise<void> => {
  try {
    await operation;
  } catch {
    // Cleanup operations are best effort.
  }
};
