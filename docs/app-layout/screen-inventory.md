# Screen Inventory

Reference image: [main-screen.png](/Users/arosot/code/sessionkid/docs/app-layout/references/main-screen.png)
Wireframe spec: [wireframe-spec.md](/Users/arosot/code/sessionkid/docs/app-layout/wireframe-spec.md)

## Screen Template

### Screen Name

- Purpose:
- Primary user actions:
- Required data:
- Empty state:
- Error state:
- Notes:

---

## Screens

### Main Workspace Screen

- Purpose: Primary desktop screen for browsing workspaces, opening a session, reading activity, and continuing the conversation
- Primary user actions: Select a workspace, switch sessions, create a session, read progress updates, inspect edited files, send a new prompt
- Required data: Workspace list, session list per workspace, active session metadata, chronological message/activity feed, composer draft state, available model options
- Empty state: Show a lightweight first-run view in the main pane prompting the user to create a workspace or start the first session
- Error state: Preserve the shell layout and show scoped inline failures for loading sessions, sending messages, or rendering activity items
- Notes: This is a fixed two-pane layout with a sidebar on the left and a conversation-oriented main pane on the right. Use [main-screen.png](/Users/arosot/code/sessionkid/docs/app-layout/references/main-screen.png) as the visual baseline for overall shell composition. Use [wireframe-spec.md](/Users/arosot/code/sessionkid/docs/app-layout/wireframe-spec.md) for width defaults and pane resizing behavior.

### Sidebar Navigation

- Purpose: Persistent navigation for workspace and session selection
- Primary user actions: Expand a workspace group, select a session, create a new session, scan recent items by timestamp
- Required data: Workspace names, session names, icons, ordering, last-updated timestamps, selected row state
- Empty state: Show the workspace heading and a clear create action with no placeholder clutter
- Error state: Keep the selected session visible if cached and show a compact retry state for failed workspace loading
- Notes: Rows should support keyboard selection, hover state, and an obvious active-item highlight. At the default sidebar width, the layout should comfortably show workspace labels and roughly 40 characters of one-line session summary before truncation.

### Session Header

- Purpose: Establish context for the active session at the top of the main pane
- Primary user actions: Confirm the active session, inspect the project/repository label, access future session actions
- Required data: Session title, parent project or repository label, optional action affordances
- Empty state: If no session is selected, replace the header with a neutral placeholder title
- Error state: Keep the title area rendered even if the feed fails below it
- Notes: The header should stay visually lightweight so the conversation remains the primary focus

### Activity Feed

- Purpose: Present the running conversation and system activity for the active session
- Primary user actions: Read prompts and responses, scan progress notes, review structured file actions
- Required data: Ordered messages, activity event type, timestamps or elapsed-time labels, file names, status indicators
- Empty state: Show a prompt to begin the first instruction in the current session
- Error state: Render prior cached activity if possible and isolate failures to the affected message block
- Notes: Feed items can mix freeform assistant text with structured rows such as explored files or edited files

### Composer

- Purpose: Let the user continue the active session from the bottom of the screen
- Primary user actions: Enter a prompt, choose a model, submit the message, trigger future attachment actions
- Required data: Draft text, model selection, submit state, disabled/loading state
- Empty state: Show instructional placeholder text in the input
- Error state: Preserve the draft and surface send failures inline
- Notes: The composer is docked to the bottom of the main pane and should remain reachable while the feed scrolls

### Tray/Menu Bar Control

- Purpose: Keep session status visible when the main window is not frontmost and route the user back when attention is needed
- Primary user actions: Open the main window, reopen the active session, jump to a session waiting for input, quit the app
- Required data: Aggregate session status, waiting-session count, highest-priority session needing attention, tray menu actions
- Empty state: Show the neutral app icon with only basic open and quit actions when no sessions exist
- Error state: Keep the tray control available even if the main window fails to render
- Notes: The tray icon should visibly change when a session is waiting for user input so the user can notice blocked work immediately
