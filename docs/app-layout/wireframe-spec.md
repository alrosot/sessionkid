# Wireframe Spec

Reference image: [main-screen.png](/Users/arosot/code/sessionkid/docs/app-layout/references/main-screen.png)

## Purpose

- Capture concrete layout defaults before implementation.
- Reduce ambiguity when scaffolding the first Tauri desktop shell.

## Main Window

- Default window behavior: Single main window
- Minimum window width: Wide enough to preserve a usable split-pane layout
- Minimum window height: Tall enough to show header, feed, and composer without compression
- Resize behavior: Fully resizable

## Split Layout

- Layout model: Two horizontal panes
- Left pane: Resizable sidebar for workspace and session navigation
- Right pane: Flexible main work area for session activity and input
- Space allocation rule: After the left pane reaches its current width, all remaining horizontal space belongs to the right pane
- Scroll rule: The shell should avoid whole-window scrolling; the right pane owns the main scrollable region for session history

## Left Pane Sizing

- Default width goal: Only wide enough to show workspace names plus a one-line session summary of about 40 characters
- Default implementation target: Start around `320px` to `360px`, then tune against real typography and row padding
- Minimum width: Must still show workspace labels, icons, and a usable truncated session summary
- Maximum width: Prevent the sidebar from taking disproportionate space from the main work area
- Resize interaction: Drag handle between panes with immediate live resize
- Persistence: Remember the user’s last sidebar width per device

## Left Pane Content Rules

- Workspace rows: Show workspace name without clipping under normal default sizing
- Workspace rows: Include a compact `+` action for starting a new session in that workspace
- Workspace rows: Do not show the full filesystem path in the sidebar list
- Session rows: Show the session title or summary on a single line with truncation after roughly 40 visible characters at default width
- Status markers: Session rows can use compact status dots or equivalent visual state indicators
- Expansion behavior: Workspace groups can collapse and expand without changing the overall shell structure

## Right Pane Sizing

- Default width rule: Consume all remaining space after sidebar sizing
- Priority: This is the main working area and should receive the majority of horizontal space
- Compression rule: Reduce sidebar growth before compromising feed readability or composer usability

## Vertical Regions

- Title bar: Compact desktop header height
- Main header: Single-row context area above the activity feed
- Activity feed: Primary flexible vertical region
- Composer: Docked at the bottom with a stable height that can grow modestly with multi-line input
- Composer submission: Support keyboard-first submission with `Command+Enter`

## Spacing And Density

- Sidebar density: Compact enough to scan many sessions quickly
- Main pane density: More open than the sidebar, optimized for reading and long-running activity
- Gutters: Consistent internal padding on both panes
- Divider: Clear but understated separator between left and right panes

## Implementation Notes

- Treat the screenshot as visual guidance for tone and proportions, not literal pixel truth
- Validate sidebar width against the actual font, row height, and timestamp formatting used in the app
- If the real content model needs more than one line in the sidebar, revisit the 40-character target instead of letting the default pane width drift arbitrarily
- The active session feed should support markdown-style content rendering for user and assistant text
- Consecutive system-note activity should collapse into a single folded block by default to reduce visual noise
