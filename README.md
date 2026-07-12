# Katsu

A desktop web browser built with Electron, React, and TypeScript featuring a unique 3D spatial interface for managing multiple browser windows.

## Features

- **3D Spatial Interface** — Navigate a virtual world where browser windows exist as movable objects in a 3D space
- **Built-in Ad Blocking** — Powered by uBlock Origin's static filtering engine for fast, privacy-focused browsing
- **File Preview** — Open and preview images, videos, and other files directly in the spatial interface
- **Custom Protocol** — `katsu://` protocol for internal navigation and file previews
- **Window Persistence** — Save and restore your window layout across sessions
- **Command Menu** — Quick access to actions via keyboard shortcut
- **Cross-Platform** — Runs on macOS, Windows, and Linux

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Zustand, Vite
- **Backend**: Electron 43, Effect (TypeScript ecosystem)
- **Build**: electron-builder, Ultracite (linting/formatting)
- **Ad Blocking**: @gorhill/ubo-core

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
# Build for your current platform
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
```

## Project Structure

```
katsu-electron/
├── src/
│   ├── electron/           # Main process code
│   │   ├── main.ts         # Electron app entry point
│   │   ├── preload.ts      # Context bridge for IPC
│   │   ├── services/       # Backend services
│   │   │   ├── ad-blocker.ts
│   │   │   ├── ipc-router.ts
│   │   │   ├── persistence.ts
│   │   │   └── protocol-handler.ts
│   │   └── filters/        # uBlock filter lists
│   └── ui/                 # Renderer process (React)
│       ├── app.tsx         # Main app component
│       ├── components/     # React components
│       │   ├── world.tsx   # 3D spatial canvas
│       │   ├── window.tsx  # Browser window wrapper
│       │   ├── minimap.tsx # Navigation minimap
│       │   └── ...
│       ├── store/          # Zustand state management
│       └── hooks/          # Custom React hooks
├── dist-electron/          # Compiled Electron code
├── dist-react/             # Built React frontend
├── electron-builder.json   # Build configuration
├── vite.config.ts          # Vite configuration
└── package.json
```

## Architecture

### Effect-TS

The Electron main process uses [Effect](https://effect.website/) for structured concurrency, dependency injection, and error handling. Services are defined as Effect contexts and provided via layers.

### IPC Communication

The renderer communicates with the main process through a typed IPC router:

```typescript
// From renderer
const result = await window.electronAPI.command({
  type: "window:control",
  payload: "minimize",
});
```

### Ad Blocking

Requests are intercepted via Electron's `webRequest` API and matched against uBlock Origin filter lists. Blocked counts are tracked per-origin and displayed in the UI.

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
