# App Structure

Reference image: [main-screen.png](/Users/arosot/code/sessionkid/docs/app-layout/references/main-screen.png)
Wireframe spec: [wireframe-spec.md](/Users/arosot/code/sessionkid/docs/app-layout/wireframe-spec.md)

## Platform Shape

- Target platform: macOS
- App shell: Desktop app shell
- Window model: Single primary desktop window for the main workflow
- Menu bar usage: Standard macOS app menu plus lightweight app actions
- Tray usage: Required for session visibility and background status signaling

## Navigation Model

- Primary navigation pattern: Two-pane split layout with a persistent left sidebar and a main content pane
- Secondary navigation pattern: Hierarchical list navigation inside the sidebar
- Deep-linking needs: Direct selection of a workspace and session from local app state; URL-style routing is not required yet

## Top-Level Sections

1. Workspace Sidebar
   - Purpose: Let the user browse workspaces and select a session within each workspace
   - Key actions: Add a workspace, select a workspace, create a new session for a workspace, switch active session
2. Session View
   - Purpose: Show the currently selected session title, project context, and chronological activity
   - Key actions: Read updates, inspect edited files, review progress notes, expand collapsed system notes, keep context on the active task
3. Composer Area
   - Purpose: Capture the next user instruction or follow-up prompt inside the active session
   - Key actions: Type a message, paste images, choose model, submit input with keyboard shortcut, interrupt a running session

## Layout Regions

1. Title Bar
   - macOS traffic lights on the left
   - Compact utility control on the right
2. Left Sidebar
   - Resizable by the user
   - Defaults to the minimum comfortable width needed for workspace names and an approximately 40-character one-line session summary
   - Workspace heading and add-workspace button
   - Workspace rows with name and per-workspace new-session `+` button
   - Nested session rows under each workspace
3. Main Header
   - Active session title
   - Workspace path as a compact context label
4. Activity Feed
   - User prompt rows in chronological order
   - Assistant progress updates in chronological order
   - Structured activity rows for explored or edited files
   - Collapsible grouped system-note blocks
   - Markdown rendering for tables, lists, inline code, and fenced blocks in user/assistant content
5. Bottom Composer
   - Large text input anchored to the bottom
   - Model selector
   - Interrupt action while a session is running
   - Message send is keyboard-first via `Command+Enter`
6. Tray/Menu Bar Presence
   - Persistent tray icon while the app is running
   - Visual state changes based on aggregate session status
   - Highlighted state when any session is waiting for user input
   - Minimal current actions for reopening the app and quitting

## Data And State Boundaries

- Local app state: Selected workspace, selected session, current draft input, expanded system-note groups, tray icon state
- Persisted user data: Workspace list, session metadata, activity history, selected workspace/session
- Temporary session data: In-flight assistant status, Codex turn lifecycle, pending user-input request ids, transient loading states

## Session Status Model

- Idle: No active execution and no pending user action
- Running: Agent is actively working
- Waiting For User Input: Agent cannot continue until the user responds
- Error: Session requires recovery or explicit retry

## Tray Behavior

- Default state: Neutral tray icon when no sessions need attention
- Busy state: Distinct active state when one or more sessions are running
- Attention state: Stronger highlighted state when any session is waiting for user input
- Error state: Distinct warning state when any session has failed
- Interaction model: Clicking the tray icon reopens the app; deeper attention-targeting is not implemented yet

## Key Flows

1. First launch: Open the main split view with an empty workspace list and an obvious path to add the first workspace
2. Main recurring workflow: Select a workspace, start or reopen a session, review prior activity, then continue the same session in the composer
3. Attention recovery workflow: Notice a tray icon state change, reopen the app, select the waiting session, and provide the requested input
4. Session authoring workflow: Use the workspace-level `+` button to begin a new session without losing the workspace context
5. Resume workflow: Reopen the app and continue a previously saved session using its persisted local state and Codex thread id

## Window/Layout Rules

- Minimum window size: Sized for a readable two-pane desktop layout with a persistent sidebar
- Resizable: Yes
- Multi-window support: Not required initially
- Close behavior: Closing the main window hides the app to the tray instead of quitting
- Modal usage: Reserve for destructive confirmations, settings, or focused secondary tasks
- Pane resizing: The left sidebar is user-resizable and the right pane consumes all remaining width
- Scroll behavior: The right pane owns the main scrollable region; the sidebar should remain visually stable while browsing activity

## Design Constraints

- Visual tone: Modern, calm, desktop-native, and close to macOS standards where practical
- Density: Medium density with compact lists and generous reading space in the main pane
- Accessibility expectations: Strong contrast, keyboard navigation, visible focus states, and readable typography at desktop sizes

## Visual Reference Notes

- Use [main-screen.png](/Users/arosot/code/sessionkid/docs/app-layout/references/main-screen.png) as the baseline reference for pane proportions, spacing density, and the overall desktop rhythm of the main screen.
- Use [wireframe-spec.md](/Users/arosot/code/sessionkid/docs/app-layout/wireframe-spec.md) for implementation-facing sizing defaults and pane behavior.
- Preserve the high-level composition from the image: left navigation column, top context header, central activity feed, and bottom-docked composer.
- Treat the reference as directional. Product terminology, exact controls, and session behavior are defined by the written docs.
