# Product Requirements

## App Summary

- App name: Session Kid
- One-line description: macOS desktop app for monitoring and managing agent coding sessions
- Primary outcome for the user: Keep multiple agent coding sessions organized by workspace, inspect activity, and continue a selected session without losing context.

## Target Users

- Primary user: Individual developer running long-lived coding-agent sessions locally
- Secondary user: Technical user managing multiple local repositories or experiments at once
- Context of use: Desktop-first workflow on macOS, often with several workspaces and background agent activity

## Core Jobs To Be Done

1. Add local workspaces and organize sessions under them
2. Monitor agent progress, file activity, and blocked/waiting states from one desktop app
3. Continue an existing session in context instead of restarting work in a new thread

## In Scope For First Version

- Startable Tauri app on macOS
- React-based main split-pane layout with sidebar, session view, composer, and tray presence
- Local workspace picker and persisted workspace/session shell state
- Codex-first session execution using `codex app-server`
- Session activity feed with markdown rendering for assistant/user content
- Empty first-run shell with no seeded workspaces or sessions

## Out Of Scope For First Version

- Multi-provider execution support beyond Codex
- Production-grade persistence or migration strategy
- Rich approval UI beyond the current waiting-for-input flow
- Settings, authentication management, and advanced workspace configuration

## Functional Requirements

- [x] Display a persistent left sidebar of workspaces and nested sessions
- [x] Let the user add a workspace by choosing a local directory
- [x] Display an activity-focused main pane for the selected session
- [x] Provide a bottom-docked composer for continuing the active session
- [x] Continue follow-up prompts inside the same selected session rather than creating a new one
- [x] Start a new session explicitly for a selected workspace
- [x] Render assistant and user activity with markdown-style formatting, including tables
- [x] Collapse consecutive system-note messages into a single folded block by default
- [x] Provide a macOS tray/menu bar icon while the app is running
- [x] Change the tray icon state when sessions are running, waiting for user input, or errored
- [x] Let the user reopen the app from the tray
- [x] Trigger macOS notifications when a session enters the waiting-for-user-input state

## Non-Functional Requirements

- Platform: macOS
- Framework target: Tauri 2.0
- Frontend stack: React
- Performance expectations: Desktop shell should feel immediate, with the right pane staying readable and independently scrollable even with a long activity feed
- Offline/online expectations: Workspace browsing should work locally; Codex execution depends on the local Codex CLI and its upstream service availability
- Privacy/security expectations: Workspaces are local directories selected by the user; current shell persists workspace and session metadata locally and delegates execution to local Codex tooling
- Background behavior: Tray presence and status updates should remain reliable while the app is open or backgrounded
- Window-close behavior: Closing the main window hides the app to the tray instead of quitting
- Tray status behavior: The tray should show aggregate state only, not per-session counts
- Visual direction: Modern and close to macOS standards where practical

## Dependencies And Integrations

- Local system APIs: Native directory picker, tray/menu bar integration, notifications, window lifecycle hooks
- External services: Codex via the local `codex app-server` process
- File system access: User-selected workspace directories

## Risks And Unknowns

- The current Codex transport is compile-verified but still early in real-runtime validation against diverse session flows
- Approval and waiting-for-input UX is intentionally narrow and may need a richer surface once more Codex request types are handled
- Local-storage persistence is sufficient for the scaffold stage but not yet a durable product persistence model

## Open Questions

- When should workspace/session persistence move from local storage to an application-owned store?
- How much of the Codex approval model should be exposed inline versus through separate UI surfaces?
- When multi-provider support arrives, which provider-neutral event fields belong in the shared session model versus provider adapters?
