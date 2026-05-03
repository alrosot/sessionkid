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
- Primary user actions: Select a workspace, switch sessions, create a session for a workspace, read progress updates, inspect edited files, continue an existing session, send a new prompt
- Required data: Workspace list, session list per workspace, active session metadata, chronological message/activity feed, composer draft state, available model options, grouped system-note state
- Empty state: Show the app shell in a no-data state with no workspaces or sessions yet, keeping the split-pane structure visible
- Error state: Preserve the shell layout and show scoped inline failures for loading sessions, sending messages, or rendering activity items
- Notes: This is a fixed two-pane layout with a sidebar on the left and a conversation-oriented main pane on the right. The right pane is the independently scrollable region for long session history. Use [main-screen.png](/Users/arosot/code/sessionkid/docs/app-layout/references/main-screen.png) as the visual baseline for overall shell composition. Use [wireframe-spec.md](/Users/arosot/code/sessionkid/docs/app-layout/wireframe-spec.md) for width defaults and pane resizing behavior.

### Sidebar Navigation

- Purpose: Persistent navigation for workspace and session selection
- Primary user actions: Add a workspace, select a workspace, create a new session for that workspace, select a session
- Required data: Workspace names, session names, ordering, selected row state, per-session status, session counts
- Empty state: Show the workspace heading and an otherwise empty navigation area with no seeded workspaces or sessions
- Error state: Keep the selected session visible if cached and show a compact retry state for failed workspace loading
- Notes: Rows should support keyboard selection, hover state, and an obvious active-item highlight. Workspace rows should not display the full filesystem path. At the default sidebar width, the layout should comfortably show workspace labels and roughly 40 characters of one-line session summary before truncation.

### Session Header

- Purpose: Establish context for the active session at the top of the main pane
- Primary user actions: Confirm the active session and inspect its workspace context
- Required data: Session title, workspace context label
- Empty state: If no session is selected, replace the header with a neutral placeholder title
- Error state: Keep the title area rendered even if the feed fails below it
- Notes: The header should stay visually lightweight so the conversation remains the primary focus

### Activity Feed

- Purpose: Present the running conversation and system activity for the active session
- Primary user actions: Read prompts and responses, scan progress notes, review structured file actions, expand collapsed system notes
- Required data: Ordered messages, activity event type, file names, status indicators
- Empty state: Show a prompt to begin the first instruction in the current session
- Error state: Render prior cached activity if possible and isolate failures to the affected message block
- Notes: Feed items can mix freeform assistant text with structured rows such as explored files or edited files. User and assistant content should render markdown-style formatting. Consecutive system-note entries should be grouped into one collapsed block by default.

### Composer

- Purpose: Let the user continue the active session from the bottom of the screen
- Primary user actions: Enter a prompt, paste images, choose a model, submit the message with `Command+Enter`, interrupt a running session
- Required data: Draft text, image attachments, model selection, disabled/loading state, selected session status
- Empty state: Show instructional placeholder text in the input
- Error state: Preserve the draft and surface send failures inline
- Notes: The composer is docked to the bottom of the main pane and should remain reachable while the feed scrolls. A separate send button is not required in the current implementation.

### Tray/Menu Bar Control

- Purpose: Keep session status visible when the main window is not frontmost and route the user back when attention is needed
- Primary user actions: Open the main window, quit the app
- Required data: Aggregate session status, tray menu actions
- Empty state: Show the neutral app icon with only basic open and quit actions when no sessions exist
- Error state: Keep the tray control available even if the main window fails to render
- Notes: The tray icon should visibly change when a session is waiting for user input so the user can notice blocked work immediately. Waiting state should also trigger a macOS notification.
