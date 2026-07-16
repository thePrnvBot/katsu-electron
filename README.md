# Katsu

A desktop web browser built with Electron, React, and TypeScript featuring a unique 3D spatial interface for managing multiple browser windows.

## Features

- **3D Spatial Interface** — Navigate a grid-based virtual world where browser windows exist as movable, resizable objects in 2D space with camera panning and zoom
- **Built-in Ad Blocking** — Powered by uBlock Origin's static filtering engine for fast, privacy-focused browsing
- **File Previews** — Open and preview images, videos, audio, text files, and downloads directly in the spatial interface
- **Window Layouts** — Snap windows to predefined layouts (half, quarter, centered) within the current grid cell
- **Custom Protocol** — `katsu://` protocol for internal navigation and file previews
- **Window Persistence** — Save and restore your window layout across sessions
- **Command Menu** — Quick access to actions via keyboard shortcut
- **Permission Handling** — Intercept and approve/deny web permission requests (geolocation, camera, microphone, etc.)
- **Cross-Platform** — Runs on macOS, Windows, and Linux

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Zustand, Vite
- **Backend**: Electron 43, Effect (TypeScript ecosystem)
- **Build**: electron-builder, Ultracite (linting/formatting), Husky (git hooks), Knip (dead code detection)
- **Ad Blocking**: @gorhill/ubo-core
- **Icons**: Lucide React
- **Command Menu**: cmdk
- **Window Management**: react-rnd

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v22+)
- [pnpm](https://pnpm.io/) package manager

### Setup

```bash
# Clone the repository
git clone https://github.com/thePrnvBot/katsu-electron.git
cd katsu-electron

# Install dependencies
pnpm install
```

## Development

```bash
# Start dev server (runs both React and Electron in parallel)
pnpm dev

# Or run individually:
pnpm dev:react    # Vite dev server on port 5123
pnpm dev:electron # Electron app (waits for transpile)
```

The app will launch with hot module replacement enabled for the React frontend.

## Building

```bash
# Transpile Electron main process code
pnpm transpile:electron

# Build React frontend for production
pnpm build

# Create distributable packages
pnpm dist:mac     # macOS (DMG, ARM64)
pnpm dist:win     # Windows (Portable, MSI, x64)
pnpm dist:linux   # Linux (AppImage, x64)
```

Output files will be in the `dist/` directory.

## Code Quality

This project uses Ultracite with Oxlint and Oxfmt for linting and formatting.

```bash
# Check for lint/format issues
pnpm check

# Auto-fix lint/format issues
pnpm fix

# Check for unused code
pnpm knip
```

## Project Structure

```
katsu-electron/
├── src/
│   ├── electron/           # Main process code
│   │   ├── main.ts         # Electron app entry point
│   │   ├── preload.ts      # Context bridge for IPC
│   │   ├── webview-preload.ts  # Preload for webview tags
│   │   ├── window-manager.ts   # Main window lifecycle
│   │   ├── util.ts         # Shared utilities
│   │   ├── ipc/            # IPC handler definitions
│   │   │   └── handlers.ts
│   │   ├── layers/         # Effect dependency layers
│   │   │   └── main-layer.ts
│   │   ├── schemas/        # Effect schema definitions
│   │   │   └── ipc-schemas.ts
│   │   ├── services/       # Backend services
│   │   │   ├── ad-blocker.ts
│   │   │   ├── ipc-router.ts
│   │   │   ├── permissions.ts
│   │   │   ├── persistence.ts
│   │   │   └── protocol-handler.ts
│   │   ├── session/        # Session setup and listeners
│   │   │   └── setup.ts
│   │   ├── shared/         # Shared types and errors
│   │   │   ├── types.ts
│   │   │   └── errors/
│   │   ├── types/          # Additional type declarations
│   │   │   └── ubo-core.d.ts
│   │   └── filters/        # uBlock filter lists
│   └── ui/                 # Renderer process (React)
│       ├── app.tsx         # Main app component
│       ├── main.tsx        # React entry point
│       ├── index.css       # Global styles
│       ├── components/     # React components
│       │   ├── world.tsx       # Spatial canvas and camera
│       │   ├── window.tsx      # Browser window wrapper
│       │   ├── minimap.tsx     # Navigation minimap
│       │   ├── camera-animator.tsx
│       │   ├── command-menu.tsx
│       │   ├── search-bar.tsx
│       │   ├── title-bar.tsx
│       │   ├── file-preview.tsx
│       │   ├── permission-dialog.tsx
│       │   ├── error-overlay.tsx
│       │   └── preview/        # File preview components
│       │       ├── image-preview.tsx
│       │       ├── video-preview.tsx
│       │       ├── audio-preview.tsx
│       │       ├── text-preview.tsx
│       │       └── download-preview.tsx
│       ├── store/          # Zustand state management
│       │   ├── window-store.ts
│       │   ├── camera-store.ts
│       │   └── settings-store.ts
│       ├── hooks/          # Custom React hooks
│       │   ├── use-auto-hide.ts
│       │   ├── use-center-window.ts
│       │   └── use-webview-events.ts
│       ├── lib/            # Shared utilities
│       │   ├── constants.ts
│       │   └── utils.ts
│       ├── utils/          # Domain utilities
│       │   ├── file-preview.ts
│       │   ├── layout.ts
│       │   └── window-layouts.ts
│       ├── types/          # Renderer type declarations
│       │   └── electron.d.ts
│       └── assets/         # Static assets
├── dist-electron/          # Compiled Electron code
├── dist-react/             # Built React frontend
├── electron-builder.json   # Build configuration
├── vite.config.ts          # Vite configuration
├── oxfmt.config.ts         # Formatter configuration
├── oxlint.config.ts      # Linter configuration
├── knip.json               # Unused code detector config
└── package.json
```

## Architecture

### Effect-TS

The Electron main process uses [Effect](https://effect.website/) for structured concurrency, dependency injection, and error handling. Services are defined as Effect contexts and composed via layers in `layers/main-layer.ts`.

### IPC Communication

The renderer communicates with the main process through a typed IPC router with schema-validated commands:

```typescript
// Supported command types:
// - "dialog:openFile"     — Open native file dialog
// - "state:load"          — Load persisted window state
// - "state:save"          — Save current window state
// - "settings:save"       — Save user settings
// - "window:control"      — minimize / maximize / close
// - "permission:respond"  — Grant or deny a permission request
```

### Ad Blocking

Requests are intercepted via Electron's `webRequest` API and matched against uBlock Origin filter lists. Blocked counts are tracked per-origin and displayed in the UI.

### Session Management

The `session/setup.ts` module configures the Electron session with ad blocking, custom protocol handling, web contents listeners, and a cleaned user agent string.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run `pnpm check` before committing
4. Commit your changes (`git commit -m 'feat: add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is private and not currently licensed for public use. Contact the author for permissions.

## Author

**thePrnvBot** — [GitHub](https://github.com/thePrnvBot)
