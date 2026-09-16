/** Size-capped streaming reader shared by the text and Markdown previews. */

const MAX_TEXT_PREVIEW_BYTES = 16 * 1024 * 1024;

/** Read a response body as text, aborting past the preview size cap. */
export const readTextPreview = async (response: Response): Promise<string> => {
  const contentLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_TEXT_PREVIEW_BYTES
  ) {
    throw new Error("Text preview exceeds maximum size");
  }

  if (!response.body) {
    const text = await response.text();
    if (text.length > MAX_TEXT_PREVIEW_BYTES) {
      throw new Error("Text preview exceeds maximum size");
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;
  // Streaming reads are inherently sequential: each read feeds the same
  // capped accumulator, so parallelizing is impossible.
  // oxlint-disable eslint/no-await-in-loop -- sequential stream consumption
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        chunks.push(decoder.decode());
        return chunks.join("");
      }
      bytesRead += result.value.byteLength;
      if (bytesRead > MAX_TEXT_PREVIEW_BYTES) {
        await reader.cancel();
        throw new Error("Text preview exceeds maximum size");
      }
      chunks.push(decoder.decode(result.value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }
  // oxlint-enable eslint/no-await-in-loop
};
