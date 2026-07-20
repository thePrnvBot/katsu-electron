export const GRID_COLS = 10;
export const GRID_ROWS = 10;

export const APP_TITLEBAR_HEIGHT = 32;
export const WINDOW_TITLEBAR_HEIGHT = 36;
export const WINDOW_BORDER = 4;

/** Fallback bounds for windows without restored/native sizing. */
export const DEFAULT_WINDOW_WIDTH = 600;
export const DEFAULT_WINDOW_HEIGHT = 400;
export const DEFAULT_WINDOW_X = 100;
export const DEFAULT_WINDOW_Y = 100;

/** Camera/world behaviour. */
export const WHEEL_CELL_THRESHOLD = 80;
export const PEEK_SCALE = 0.9;
/** Webviews this many cells away (Chebyshev) stay mounted. */
export const WEBVIEW_LIVE_CELL_RADIUS = 1;

/** Auto-hide chrome (search bar, minimap). */
export const AUTO_HIDE_DELAY_MS = 2500;
export const SHOW_THROTTLE_MS = 250;

/** z-index ladder — keep ordered. */
export const Z_SEARCH_BAR = 40;
export const Z_PERMISSION_DIALOG = 60;
export const Z_DRAG_OVERLAY = 9998;
export const Z_MINIMAP = 9999;
export const Z_COMMAND_MENU = 99_999;

/** Keyboard window management. */
export const WINDOW_KEYBOARD_NUDGE_PX = 10;

/** Arrow key -> cell delta. Shared by camera navigation + window keyboard control. */
export const ARROW_DELTAS: Record<string, readonly [number, number]> = {
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
};

export const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "ico",
]);

export const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "ogg",
  "mov",
  "mkv",
  "avi",
]);

export const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "ogg",
  "aac",
  "flac",
  "m4a",
  "wma",
]);

export const TEXT_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "md",
  "css",
  "html",
  "htm",
  "xml",
  "svg",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "env",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "sh",
  "bash",
  "zsh",
  "fish",
  "ps1",
  "bat",
  "cmd",
  "sql",
  "graphql",
  "gql",
  "txt",
  "log",
  "csv",
  "tsv",
]);
