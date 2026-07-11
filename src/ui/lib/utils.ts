export const cn = (...inputs: (string | undefined | null | false)[]): string =>
  inputs.filter(Boolean).join(" ");
