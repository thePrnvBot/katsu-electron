/** Lazily-loaded Shiki highlighter for syntax-highlighted code previews. */

import type {
  HighlighterCore,
  LanguageRegistration,
  ThemedToken,
} from "shiki/core";

const THEME = "github-dark-default";

/** Above this size, highlighting is skipped and plain text renders instead. */
const MAX_HIGHLIGHT_CHARS = 500_000;

/** File extension to bundled Shiki grammar. Unlisted extensions stay plain. */
const LANGUAGE_BY_EXTENSION = new Map<string, string>([
  ["bash", "shellscript"],
  ["bat", "bat"],
  ["c", "c"],
  ["cmd", "bat"],
  ["conf", "ini"],
  ["cpp", "cpp"],
  ["css", "css"],
  ["diff", "diff"],
  ["env", "dotenv"],
  ["go", "go"],
  ["gql", "graphql"],
  ["graphql", "graphql"],
  ["h", "c"],
  ["hpp", "cpp"],
  ["htm", "html"],
  ["html", "html"],
  ["ini", "ini"],
  ["java", "java"],
  ["js", "javascript"],
  ["json", "json"],
  ["jsx", "jsx"],
  ["ps1", "powershell"],
  ["py", "python"],
  ["rb", "ruby"],
  ["rs", "rust"],
  ["sh", "shellscript"],
  ["sql", "sql"],
  ["svg", "xml"],
  ["toml", "toml"],
  ["ts", "typescript"],
  ["tsx", "tsx"],
  ["xml", "xml"],
  ["yaml", "yaml"],
  ["yml", "yaml"],
  ["zsh", "shellscript"],
]);

interface LanguageModule {
  readonly default: LanguageRegistration[];
}

/** One lazy import per shipped grammar so only used grammars are bundled. */
const LANGUAGE_LOADERS = new Map<string, () => Promise<LanguageModule>>([
  ["bat", () => import("shiki/langs/bat.mjs")],
  ["c", () => import("shiki/langs/c.mjs")],
  ["cpp", () => import("shiki/langs/cpp.mjs")],
  ["css", () => import("shiki/langs/css.mjs")],
  ["diff", () => import("shiki/langs/diff.mjs")],
  ["dotenv", () => import("shiki/langs/dotenv.mjs")],
  ["go", () => import("shiki/langs/go.mjs")],
  ["graphql", () => import("shiki/langs/graphql.mjs")],
  ["html", () => import("shiki/langs/html.mjs")],
  ["ini", () => import("shiki/langs/ini.mjs")],
  ["java", () => import("shiki/langs/java.mjs")],
  ["javascript", () => import("shiki/langs/javascript.mjs")],
  ["json", () => import("shiki/langs/json.mjs")],
  ["jsx", () => import("shiki/langs/jsx.mjs")],
  ["powershell", () => import("shiki/langs/powershell.mjs")],
  ["python", () => import("shiki/langs/python.mjs")],
  ["ruby", () => import("shiki/langs/ruby.mjs")],
  ["rust", () => import("shiki/langs/rust.mjs")],
  ["shellscript", () => import("shiki/langs/shellscript.mjs")],
  ["sql", () => import("shiki/langs/sql.mjs")],
  ["toml", () => import("shiki/langs/toml.mjs")],
  ["tsx", () => import("shiki/langs/tsx.mjs")],
  ["typescript", () => import("shiki/langs/typescript.mjs")],
  ["xml", () => import("shiki/langs/xml.mjs")],
  ["yaml", () => import("shiki/langs/yaml.mjs")],
]);

let highlighterPromise: Promise<HighlighterCore> | null = null;

const createHighlighter = async (): Promise<HighlighterCore> => {
  const [core, engine, theme] = await Promise.all([
    import("shiki/core"),
    import("shiki/engine/javascript"),
    import("shiki/themes/github-dark-default.mjs"),
  ]);
  return core.createHighlighterCore({
    engine: engine.createJavaScriptRegexEngine({ forgiving: true }),
    langs: [],
    themes: [theme.default],
  });
};

const getHighlighter = (): Promise<HighlighterCore> => {
  highlighterPromise ??= createHighlighter();
  return highlighterPromise;
};

/** Shiki grammar for a file extension, or null when unsupported. */
export const languageForExtension = (extension: string): string | null =>
  LANGUAGE_BY_EXTENSION.get(extension) ?? null;

/**
 * Tokenize code for a file extension. Returns null when the extension is
 * unsupported, the file is too large, or tokenizing fails, so callers fall
 * back to plain text.
 */
export const highlightCode = async (
  code: string,
  extension: string
): Promise<readonly (readonly ThemedToken[])[] | null> => {
  const language = languageForExtension(extension);
  const loadLanguage =
    language === null ? undefined : LANGUAGE_LOADERS.get(language);
  if (
    language === null ||
    loadLanguage === undefined ||
    code.length > MAX_HIGHLIGHT_CHARS
  ) {
    return null;
  }

  try {
    const highlighter = await getHighlighter();
    if (!highlighter.getLoadedLanguages().includes(language)) {
      const module = await loadLanguage();
      await highlighter.loadLanguage(...module.default);
    }
    return highlighter.codeToTokens(code, { lang: language, theme: THEME })
      .tokens;
  } catch {
    return null;
  }
};
