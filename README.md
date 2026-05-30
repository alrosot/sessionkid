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

## Packaging for macOS distribution

Use Tauri's release build to produce a macOS app bundle and installer artifacts:

```bash
npm install
npm run tauri build
```

Build outputs are written under:

```bash
src-tauri/target/release/bundle/
```

On macOS, the main artifacts are typically:

- `src-tauri/target/release/bundle/macos/Session Kid.app`
- `src-tauri/target/release/bundle/dmg/Session Kid_0.1.0_*.dmg`

For a machine-local install test, open the generated `.dmg` or copy `Session Kid.app` into `/Applications`.

### Release prep

Before building a distributable release, keep the app version aligned in:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

If you want a universal macOS build that supports both Apple Silicon and Intel Macs:

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

### Unsigned vs signed builds

For local packaging and install testing, an unsigned build is usually enough:

```bash
npm run tauri build -- --no-sign
```

macOS Gatekeeper may block the first launch of an unsigned app. If that happens, open it with Finder's `Open` action or move it into `/Applications` and allow it in System Settings.

For distribution outside your own machine, you should build a signed and notarized app. That requires:

- an Apple Developer account
- a Developer ID Application certificate installed in Keychain
- notarization credentials configured for the build environment

Once signing and notarization are configured, run the normal build again without `--no-sign`:

```bash
npm run tauri build
```

### Recommended release check

Before sharing a build, verify:

- the app launches from `/Applications`
- the tray/menu bar behavior still works
- workspace selection and session persistence still work
- the bundled app can start the local `codex app-server` successfully

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
