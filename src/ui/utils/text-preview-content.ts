/** Size-capped streaming reader shared by the text and Markdown previews. */

const MAX_TEXT_PREVIEW_BYTES = 16 * 1024 * 1024;

const readTextStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  chunks: string[],
  bytesRead: number
): Promise<string> => {
  const result = await reader.read();
  if (result.done) {
    chunks.push(decoder.decode());
    return chunks.join("");
  }

  const nextBytesRead = bytesRead + result.value.byteLength;
  if (nextBytesRead > MAX_TEXT_PREVIEW_BYTES) {
    await reader.cancel();
    throw new Error("Text preview exceeds maximum size");
  }
  chunks.push(decoder.decode(result.value, { stream: true }));
  return readTextStream(reader, decoder, chunks, nextBytesRead);
};

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
  try {
    return await readTextStream(reader, decoder, chunks, 0);
  } finally {
    reader.releaseLock();
  }
};
