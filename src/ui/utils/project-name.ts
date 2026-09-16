/** Derives a short, human-readable project name from a generation prompt. */

const MAX_LENGTH = 48;
const TRAILING_PUNCTUATION = /[.!?,;:]+$/u;
const WHITESPACE_RUN = /\s+/gu;

/** First line of the prompt, trimmed to a single-line window title. */
export const projectNameFromPrompt = (prompt: string): string => {
  const firstLine = prompt.split("\n", 1)[0] ?? "";
  const normalizedLine = firstLine
    .trim()
    .replace(WHITESPACE_RUN, " ")
    .replace(TRAILING_PUNCTUATION, "");
  if (normalizedLine.length === 0) {
    return "Untitled project";
  }
  return normalizedLine.length > MAX_LENGTH
    ? `${normalizedLine.slice(0, MAX_LENGTH - 1).trimEnd()}…`
    : normalizedLine;
};
