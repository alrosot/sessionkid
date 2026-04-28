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
- Deep-linking needs: Direct selection of a workspace and session from local app state or URL-like route state

## Top-Level Sections

1. Workspace Sidebar
   - Purpose: Let the user browse workspaces and select a session within each workspace
   - Key actions: Expand workspace groups, switch active session, create a new session, view relative recency
2. Session View
   - Purpose: Show the currently selected session title, related project context, and chronological activity
   - Key actions: Read updates, inspect edited files, review progress notes, keep context on the active task
3. Composer Area
   - Purpose: Capture the next user instruction or follow-up prompt inside the active session
   - Key actions: Type a message, attach context later, choose model, submit input

## Layout Regions

1. Title Bar
   - macOS traffic lights on the left
   - Compact utility control on the right
2. Left Sidebar
   - Resizable by the user
   - Defaults to the minimum comfortable width needed for workspace names and an approximately 40-character one-line session summary
   - Workspace heading and add button
   - Workspace group rows with icon and label
   - Indented session rows under each workspace
   - Relative timestamps aligned on the right for recent items
3. Main Header
   - Active session title
   - Small project/repository context label
4. Activity Feed
   - User prompt bubble near the top of the conversation
   - Assistant progress updates in chronological order
   - Structured activity rows for explored or edited files
5. Bottom Composer
   - Large text input anchored to the bottom
   - Left-side utility/action button
   - Model selector near the bottom-left
   - Primary send button on the bottom-right
6. Tray/Menu Bar Presence
   - Persistent tray icon while the app is running
   - Visual state changes based on aggregate session status
   - Highlighted state when any session is waiting for user input
   - Quick actions for opening the app and jumping to attention-needed sessions

## Data And State Boundaries

- Local app state: Sidebar expansion state, selected workspace, selected session, current draft input, scroll position, tray icon state
- Persisted user data: Workspace list, session metadata, message history, file activity summaries, UI preferences
- Temporary session data: In-flight assistant status, partial streamed output, transient loading states, per-session attention flags

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
- Interaction model: Clicking the tray icon opens the app and can focus the highest-priority session needing attention

## Key Flows

1. First launch: Open the main split view with an empty or seeded workspace list and an obvious path to start a session
2. Main recurring workflow: Select a workspace, choose a session, review prior activity, then continue the conversation in the composer
3. Attention recovery workflow: Notice a tray icon state change, reopen the app, jump to the waiting session, and provide the requested input
4. Settings/configuration: Access app preferences for model defaults, appearance, notification behavior, and workspace-level behavior without disrupting the main session view

## Window/Layout Rules

- Minimum window size: Sized for a readable two-pane desktop layout with a persistent sidebar
- Resizable: Yes
- Multi-window support: Not required initially
- Close behavior: User-configurable, with support for keeping the app available via the tray after the window is closed
- Modal usage: Reserve for destructive confirmations, settings, or focused secondary tasks
- Pane resizing: The left sidebar is user-resizable and the right pane consumes all remaining width

## Design Constraints

- Visual tone: Dark, focused, desktop-native, calm, and work-oriented
- Density: Medium density with compact lists and generous reading space in the main pane
- Accessibility expectations: Strong contrast, keyboard navigation, visible focus states, and readable typography at desktop sizes

## Visual Reference Notes

- Use [main-screen.png](/Users/arosot/code/sessionkid/docs/app-layout/references/main-screen.png) as the baseline reference for pane proportions, spacing density, and the overall desktop rhythm of the main screen.
- Use [wireframe-spec.md](/Users/arosot/code/sessionkid/docs/app-layout/wireframe-spec.md) for implementation-facing sizing defaults and pane behavior.
- Preserve the high-level composition from the image: left navigation column, top context header, central activity feed, and bottom-docked composer.
- Treat the reference as directional. Product terminology, exact controls, and session behavior are defined by the written docs.
