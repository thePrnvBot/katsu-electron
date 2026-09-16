/** Playful words shown while an artifact is being generated. */

export const LOADING_WORDS = [
  "Flibbetibgibbeting",
  "Bamboozling",
  "Discombobulating",
  "Confabulating",
  "Gallivanting",
  "Percolating",
  "Finagling",
  "Skedaddling",
  "Kibitzing",
  "Flummoxing",
  "Conjuring",
  "Puttering",
  "Noodling",
] as const;

/** A random loading word; never repeats the previous one. */
export const randomLoadingWord = (excludeWord?: string): string => {
  const candidates = LOADING_WORDS.filter((word) => word !== excludeWord);
  const wordIndex = Math.floor(Math.random() * candidates.length);
  return candidates[wordIndex] ?? LOADING_WORDS[0];
};
