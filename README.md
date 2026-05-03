# Session Kid

Session Kid is a macOS desktop app for monitoring and managing agent coding sessions. It is built with Tauri 2.0 and React.

## Current state

- Codex-first execution through local `codex app-server`
- Workspace-based session management
- Persistent local session state across app relaunches
- Resizable sidebar with nested workspace and session navigation
- Independently scrollable session pane
- Markdown-rendered activity feed
- Grouped and collapsible system notes
- Keyboard-first composer with `Command+Enter` submission
- Image paste support in prompts
- Model discovery from Codex
- Theme selection
- Hide-to-tray close behavior, tray state updates, and waiting-for-input notifications

## Tech stack

- Tauri 2.0
- React
- Vite
- Rust
- Codex App Server

## Source of truth

Product and layout decisions still live in `docs/`:

- `docs/requirements/product-requirements.md`
- `docs/app-layout/app-structure.md`
- `docs/app-layout/screen-inventory.md`
- `docs/app-layout/wireframe-spec.md`

## Requirements

- macOS
- Rust toolchain
- Node.js / npm
- Codex CLI installed locally

## Local development

Install dependencies:

```bash
npm install
```

Then run the app:

```bash
npm run tauri dev
```

## Persistence

- Session state is stored locally on disk by the app.
- On macOS, the current path is:

```bash
~/Library/Application Support/com.sessionkid.app/session-state.json
```

## Notes

- There are no seeded workspaces or sessions on first run.
- Codex is the only execution provider implemented right now.
- Session continuity depends on persisted local state plus Codex thread resume.
