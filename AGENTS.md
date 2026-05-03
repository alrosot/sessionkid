# AGENTS.md

This file is for coding agents working in this repository.

## Purpose

- Build a macOS desktop app using Tauri 2.0.
- App name: `Session Kid`
- Keep `README.md` human-oriented.
- Use this file as the fast orientation layer before making changes.

## Current Repo State

- The repo now has a working Tauri 2.0 scaffold.
- The frontend shell, local workspace/session UI, and Codex-first execution path are implemented.
- Current source of truth lives under `docs/`.

## Source Of Truth

- Product requirements: [docs/requirements/product-requirements.md](/Users/arosot/code/sessionkid/docs/requirements/product-requirements.md:1)
- App structure: [docs/app-layout/app-structure.md](/Users/arosot/code/sessionkid/docs/app-layout/app-structure.md:1)
- Screen inventory: [docs/app-layout/screen-inventory.md](/Users/arosot/code/sessionkid/docs/app-layout/screen-inventory.md:1)
- Wireframe sizing and pane behavior: [docs/app-layout/wireframe-spec.md](/Users/arosot/code/sessionkid/docs/app-layout/wireframe-spec.md:1)
- Visual reference: [docs/app-layout/references/main-screen.png](/Users/arosot/code/sessionkid/docs/app-layout/references/main-screen.png)

If code and docs disagree, prefer the docs unless the user explicitly changes direction.

## Product Terminology

- Use `session`, for the primary unit of work in the UI.
- A `workspace` contains multiple sessions.
- The right pane is the main working area for the active session.

## Planned Application Structure

- Single main macOS window
- Two-pane split layout
- Left pane: workspace and session navigation
- Right pane: session header, activity feed, and bottom-docked composer
- Tray/menu bar presence is required
- Frontend stack: React
- Current execution provider: Codex via local `codex app-server`

## Layout Rules

- The left sidebar is user-resizable.
- Default sidebar width should only be large enough to display workspace names plus roughly 40 characters of one-line session summary.
- Initial implementation target for sidebar width: `320px` to `360px`
- The right pane should consume all remaining horizontal space.
- The right pane should be the independently scrollable region for long session history.
- Preserve a desktop-oriented, high-density layout without turning the main reading area cramped.
- Default first-run shell should render in an empty state with no seeded workspaces or sessions.

## Tray And Status Model

Session states currently implemented:

- `Idle`
- `Running`
- `Waiting For User Input`
- `Error`

Tray expectations:

- Neutral state when no sessions need attention
- Distinct busy state when sessions are running
- Stronger highlighted state when any session is waiting for user input
- Distinct error state when any session has failed
- Tray reflects aggregate app/session state only, not per-session counts
- Tray should be able to reopen the app
- Closing the main window should hide the app to the tray instead of quitting
- Waiting-for-input sessions should also trigger macOS notifications

## Implementation Guardrails

- Treat `main-screen.png` as visual guidance, not literal pixel truth.
- Keep the right pane prioritized when making layout tradeoffs.
- Session summaries should be trimmed at 40 characters
- Keep tray behavior in mind when designing window lifecycle and close/minimize behavior.
- Workspace rows should not show full filesystem paths in the sidebar.
- Consecutive system-note activity should be grouped into a single collapsed block by default.
- User and assistant activity content should render markdown-style formatting where possible.

## Current Implementation Notes

- Workspace selection uses the native directory picker and persists locally.
- A workspace can contain multiple sessions.
- Replying in a selected session should continue that same session instead of creating a new one.
- A workspace-level `+` control starts a new session for that workspace.
- The composer submits with `Command+Enter`; there is no required send button.
- The Codex transport currently runs through Tauri-owned `codex app-server` process management.

## Human Collaboration

- Keep `README.md` readable for humans.
- Put implementation-specific product structure updates here only if they help future coding agents orient faster.
- Put lasting product decisions back into the `docs/` files so this file stays a compact map, not a second source of truth.
