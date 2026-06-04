# ReFile

Desktop viewer (Electron + React) for ReFile virtual "pointer" files — opens `.refile`/`.repic`/`.revid`/`.remusic` files, fetches the real media from its cloud URL, and previews/downloads it.

> Note: `README.md` documents the broader ReFile ecosystem (CLI + Cloudflare Workers monorepo). **This directory only contains the desktop viewer app.** No `src/backends`, `src/commands`, or `workers/` exist here.

## Stack
- **Runtime**: Electron 33 (desktop), Node.js
- **Language**: TypeScript 5.7 (strict), ESM (`"type": "module"`)
- **UI**: React 19 + Tailwind CSS 4 (`@tailwindcss/vite`)
- **Build**: Vite 6, electron-builder 26 (NSIS installer, Windows)
- **Entry (main process)**: `electron/main.cjs` (CommonJS)
- **Entry (renderer)**: `src/main.tsx` → `src/App.tsx`

## Directory structure

```
electron/
  main.cjs          ← Electron main process: window, IPC handlers, file associations
  preload.cjs       ← contextBridge → exposes window.refileAPI to renderer
src/
  main.tsx          ← React mount
  App.tsx           ← App state: open file, drag&drop, Ctrl+O, OS file-open events
  global.d.ts       ← RefilePointer type + window.refileAPI typings
  index.css         ← Tailwind entry
  components/
    TitleBar.tsx    ← Frameless custom title bar (min/max/close)
    DropZone.tsx    ← Empty state: drag&drop / open dialog, error display
    Viewer.tsx      ← Media preview (image/video/audio/generic) + metadata + download
index.html          ← Vite HTML shell
dist/               ← Vite build output (loaded by main.cjs in production)
```

## Key concepts

- **Pointer file**: small JSON (`RefilePointer` in `src/global.d.ts`) holding `url`, `mime`, `hash`, `size`, `name`, `createdAt`, `backend`. The viewer reads it, then loads the real media from `url`.
- **IPC bridge** (`preload.cjs` → `window.refileAPI`): `readPointer`, `openFileDialog`, `openExternal`, `saveFile`, window controls (`windowMinimize/Maximize/Close/IsMaximized`), and `onOpenFile` push event. `contextIsolation: true`, `nodeIntegration: false`.
- **File associations** (`package.json` `build.win.fileAssociations`): `.refile`, `.repic`, `.revid`, `.remusic`. Opening one from OS launches/refocuses the app.
- **Single instance**: `requestSingleInstanceLock()`; a second launch forwards its file arg to the running window via the `second-instance` event.
- **File-from-args**: `getFileFromArgs()` scans argv for a virtual-file extension on launch and on `second-instance`.
- **Pointer normalization**: `read-pointer` handler fills defaults so v1/v2/legacy pointers render consistently.
- **MediaViewer** (`Viewer.tsx`): branches on `mime` prefix — `image/`, `video/` (autoplay+controls), `audio/` (art placeholder + player), else generic file card.
- **Download** (`save-file` handler): `fetch(url)` → save dialog → write buffer to disk.
- **Frameless window**: `frame: false`, dark `#09090b`; custom `TitleBar` provides window controls.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server + Electron (waits on :5173, sets `VITE_DEV_SERVER_URL`) |
| `npm run build` | Vite production build → `dist/` |
| `npm run package` | `build` then `electron-builder` (NSIS Windows installer) |
| `npm run typecheck` | `tsc --noEmit` |

## Coding rules

- Renderer is TypeScript strict + ESM React function components; Electron process files are `.cjs` (CommonJS).
- IPC results use a `{ success, data?, error? }` shape — propagate errors instead of throwing across IPC.
- Keep main-process privilege boundaries: never enable `nodeIntegration`; expose capabilities only through `preload.cjs`.
- Tailwind utility classes for styling (no separate CSS modules).
