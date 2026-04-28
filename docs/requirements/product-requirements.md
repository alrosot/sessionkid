# Product Requirements

## App Summary

- App name:
- One-line description:
- Primary outcome for the user:

## Target Users

- Primary user:
- Secondary user:
- Context of use:

## Core Jobs To Be Done

1. 
2. 
3. 

## In Scope For First Version

- 
- 
- 

## Out Of Scope For First Version

- 
- 
- 

## Functional Requirements

- [ ] Display a persistent left sidebar of workspaces and nested sessions
- [ ] Display an activity-focused main pane for the selected session
- [ ] Provide a bottom-docked composer for continuing the active session
- [ ] Provide a macOS tray/menu bar icon while the app is running
- [ ] Change the tray icon state when sessions are running, waiting for user input, or errored
- [ ] Let the user reopen the app and focus an attention-needed session from the tray

## Non-Functional Requirements

- Platform: macOS
- Framework target: Tauri 2.0
- Performance expectations:
- Offline/online expectations:
- Privacy/security expectations:
- Background behavior: Tray presence and status updates should remain reliable while the app is open or backgrounded

## Dependencies And Integrations

- Local system APIs:
- External services:
- File system access:

## Risks And Unknowns

- 
- 
- 

## Open Questions

- Should closing the window hide the app to the tray by default, or fully quit?
- Should the tray icon show only aggregate status, or also a count of waiting sessions?
- Do waiting-for-input sessions also trigger macOS notifications in addition to tray state?
