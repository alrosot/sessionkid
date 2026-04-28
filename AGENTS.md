# AGENTS.md

This file is for coding agents working in this repository.

## Purpose

- Build a macOS desktop app using Tauri 2.0.
- Keep `README.md` human-oriented.
- Use this file as the fast orientation layer before making changes.

## Current Repo State

- The repo is still in the planning phase.
- There is no Tauri scaffold yet.
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

## Layout Rules

- The left sidebar is user-resizable.
- Default sidebar width should only be large enough to display workspace names plus roughly 40 characters of one-line session summary.
- Initial implementation target for sidebar width: `320px` to `360px`
- The right pane should consume all remaining horizontal space.
- Preserve a desktop-oriented, high-density layout without turning the main reading area cramped.

## Tray And Status Model

Session states currently planned:

- `Idle`
- `Running`
- `Waiting For User Input`
- `Error`

Tray expectations:

- Neutral state when no sessions need attention
- Distinct busy state when sessions are running
- Stronger highlighted state when any session is waiting for user input
- Distinct error state when any session has failed
- Tray should be able to reopen the app and focus an attention-needed session

## Implementation Guardrails

- Treat `main-screen.png` as visual guidance, not literal pixel truth.
- Keep the right pane prioritized when making layout tradeoffs.
- Session summaries should be trimmed at 40 characters
- Keep tray behavior in mind when designing window lifecycle and close/minimize behavior.

## When Scaffolding Starts

When creating the first Tauri app shell, the first milestone should be:

1. A single main window
2. A resizable left sidebar
3. A flexible right pane
4. Placeholder workspace/session data
5. A placeholder tray icon with state switching hooks

## Human Collaboration

- Keep `README.md` readable for humans.
- Put implementation-specific product structure updates here only if they help future coding agents orient faster.
- Put lasting product decisions back into the `docs/` files so this file stays a compact map, not a second source of truth.
