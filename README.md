# Session Kid

Session Kid is a macOS desktop app for monitoring and managing agent coding sessions. It is built with Tauri 2.0 and React.

## What exists now

- A Tauri 2 scaffold under `src-tauri/`
- A React + Vite frontend under `src/`
- A Codex-first desktop shell with:
  - resizable left sidebar
  - nested workspace and session navigation
  - independently scrollable right pane
  - local workspace picker
  - persisted workspace/session shell state
  - markdown-rendered activity feed
  - grouped/collapsed system notes
  - `Command+Enter` composer submission
  - Codex execution through local `codex app-server`
  - hide-to-tray window close behavior
  - tray state updates and waiting-for-input notifications

## Source of truth

Product and layout decisions still live in `docs/`:

- `docs/requirements/product-requirements.md`
- `docs/app-layout/app-structure.md`
- `docs/app-layout/screen-inventory.md`
- `docs/app-layout/wireframe-spec.md`

## Local development

Install the JavaScript dependencies:

```bash
npm install
```

Install Rust if it is not already available, then start the app:

```bash
npm run tauri dev
```

## Notes

- There are no seeded workspaces or sessions on first run.
- Codex is the only execution provider implemented right now.
- The current Codex transport is integrated, but still early enough that more runtime validation and approval UX work is expected.
