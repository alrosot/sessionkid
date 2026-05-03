import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import ActivityContent from "./components/ActivityContent";
import { CodexRunner } from "./lib/providers/codex/codexRunner";
import {
  deriveTrayState,
  emptySessionAppState,
  getSessionsForWorkspace,
  parseStoredSessionAppState,
  sessionAppReducer
} from "./lib/session/store";
import type {
  PromptImageAttachment,
  Session,
  SessionModelOption,
  Workspace
} from "./lib/session/types";

const SIDEBAR_KEY = "session-kid.sidebar-width";
const SESSION_STATE_KEY = "session-kid.session-state";
const THEME_KEY = "session-kid.theme";
const DEFAULT_SIDEBAR_WIDTH = 344;
const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 440;

const themeOptions = ["light", "dark"] as const;
type ThemeMode = (typeof themeOptions)[number];

type ActivityGroup =
  | {
      type: "single";
      activity: Session["activities"][number];
    }
  | {
      type: "system-note-group";
      id: string;
      activities: Session["activities"];
    };

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

function basename(path: string) {
  const normalized = path.replace(/[\\/]+$/, "");
  const segments = normalized.split(/[\\/]/);
  return segments[segments.length - 1] || path;
}

function formatActivityTooltip(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatSessionCreatedAt(value: string) {
  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric"
  });
}

function countVisibleMessages(session: Session) {
  return session.activities.filter(
    (activity) =>
      activity.kind === "user-message" || activity.kind === "assistant-update"
  ).length;
}

function formatSessionMeta(session: Session) {
  const messageCount = countVisibleMessages(session);
  const messageLabel = messageCount === 1 ? "1 message" : `${messageCount} messages`;
  return `${formatSessionCreatedAt(session.createdAt)} · ${messageLabel}`;
}

async function readImageAttachment(file: File): Promise<PromptImageAttachment> {
  const buffer = await file.arrayBuffer();
  return {
    id: crypto.randomUUID(),
    name: file.name || "pasted-image.png",
    mimeType: file.type || "image/png",
    bytes: Array.from(new Uint8Array(buffer)),
    previewUrl: URL.createObjectURL(file)
  };
}

function summarizeSystemNote(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function groupActivities(activities: Session["activities"]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];

  for (const activity of activities) {
    if (activity.kind !== "system-note") {
      groups.push({
        type: "single",
        activity
      });
      continue;
    }

    const previous = groups[groups.length - 1];
    if (previous?.type === "system-note-group") {
      previous.activities.push(activity);
      continue;
    }

    groups.push({
      type: "system-note-group",
      id: `system-${activity.id}`,
      activities: [activity]
    });
  }

  return groups;
}

export default function App() {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isAddingWorkspace, setIsAddingWorkspace] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [composerValue, setComposerValue] = useState("");
  const [composerAttachments, setComposerAttachments] = useState<PromptImageAttachment[]>([]);
  const [availableModels, setAvailableModels] = useState<SessionModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [expandedSystemNoteGroups, setExpandedSystemNoteGroups] = useState<Set<string>>(
    () => new Set()
  );
  const [state, dispatch] = useReducer(sessionAppReducer, emptySessionAppState);
  const [hasHydratedState, setHasHydratedState] = useState(false);
  const composerAttachmentsRef = useRef<PromptImageAttachment[]>([]);
  const dragOffsetRef = useRef(0);
  const feedRef = useRef<HTMLElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const runner = useMemo(() => new CodexRunner(), []);

  useEffect(() => {
    const savedWidth = window.localStorage.getItem(SIDEBAR_KEY);
    if (savedWidth) {
      const parsedWidth = Number(savedWidth);
      if (Number.isFinite(parsedWidth)) {
        setSidebarWidth(clampSidebarWidth(parsedWidth));
      }
    }

    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }

    dispatch({
      type: "hydrate",
      state: parseStoredSessionAppState(window.localStorage.getItem(SESSION_STATE_KEY))
    });
    setHasHydratedState(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme);
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!hasHydratedState) {
      return;
    }

    window.localStorage.setItem(SESSION_STATE_KEY, JSON.stringify(state));
  }, [hasHydratedState, state]);

  useEffect(() => {
    composerAttachmentsRef.current = composerAttachments;
  }, [composerAttachments]);

  useEffect(() => {
    return () => {
      composerAttachmentsRef.current.forEach((attachment) => {
        URL.revokeObjectURL(attachment.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    const unsubscribe = runner.subscribe((event) => {
      dispatch({ type: "runner.event", event });
    });

    return () => {
      unsubscribe();
    };
  }, [runner]);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        const models = await runner.listModels();
        if (cancelled) {
          return;
        }

        setAvailableModels(models);
        if (models.length === 0) {
          setSelectedModel("");
          return;
        }

        setSelectedModel((current) =>
          models.some((model) => model.id === current)
            ? current
            : (models.find((model) => model.isDefault)?.id ?? models[0].id)
        );
      } catch {
        if (!cancelled) {
          setAvailableModels([]);
          setSelectedModel("");
        }
      }
    }

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, [runner]);

  const trayState = deriveTrayState(state.sessions);

  useEffect(() => {
    if (!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
      return;
    }

    void invoke("set_tray_state", { state: trayState }).catch(() => null);
  }, [trayState]);

  useEffect(() => {
    let removeCloseHandler: (() => void) | undefined;

    async function bindTauriWindowHooks() {
      if (!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
        return;
      }

      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();

      removeCloseHandler = await appWindow.onCloseRequested(async (event) => {
        event.preventDefault();
        await appWindow.hide();
      });
    }

    void bindTauriWindowHooks();

    return () => {
      removeCloseHandler?.();
    };
  }, []);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      setSidebarWidth(clampSidebarWidth(event.clientX - dragOffsetRef.current));
    }

    function handlePointerUp() {
      setIsResizing(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (settingsRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsSettingsOpen(false);
      setIsThemeMenuOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isSettingsOpen]);

  const selectedWorkspace =
    state.workspaces.find((workspace) => workspace.id === state.selectedWorkspaceId) ?? null;
  const selectedSession =
    state.sessions.find((session) => session.id === state.selectedSessionId) ?? null;

  useEffect(() => {
    if (!selectedSession || !feedRef.current) {
      return;
    }

    feedRef.current.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [selectedSession?.id, selectedSession?.activities.length]);

  useEffect(() => {
    if (!selectedSession) {
      return;
    }

    setSelectedModel(selectedSession.model);
  }, [selectedSession?.id, selectedSession?.model]);

  function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
    dragOffsetRef.current = event.clientX - sidebarWidth;
    setIsResizing(true);
  }

  async function handleAddWorkspace() {
    try {
      setIsAddingWorkspace(true);

      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Workspace Directory"
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      const existing = state.workspaces.find((workspace) => workspace.path === selected);
      if (existing) {
        dispatch({ type: "workspace.selected", workspaceId: existing.id });
        return;
      }

      const workspace: Workspace = {
        id: crypto.randomUUID(),
        name: basename(selected),
        path: selected
      };

      dispatch({ type: "workspace.added", workspace });
    } finally {
      setIsAddingWorkspace(false);
    }
  }

  async function handleComposerSubmit() {
    const prompt = composerValue.trim();
    if (!prompt && composerAttachments.length === 0) {
      return;
    }

    if (selectedSession && selectedWorkspace) {
      await runner.sendInput({
        sessionId: selectedSession.id,
        input: prompt,
        model: selectedSession.model,
        workspacePath: selectedWorkspace.path,
        attachments: composerAttachments
      });
      setComposerValue("");
      composerAttachments.forEach((attachment) => {
        URL.revokeObjectURL(attachment.previewUrl);
      });
      setComposerAttachments([]);
      return;
    }

    if (!selectedWorkspace || !selectedModel) {
      return;
    }

    await runner.startSession({
      workspace: selectedWorkspace,
      prompt,
      model: selectedModel,
      attachments: composerAttachments
    });
    setComposerValue("");
    composerAttachments.forEach((attachment) => {
      URL.revokeObjectURL(attachment.previewUrl);
    });
    setComposerAttachments([]);
  }

  async function handleInterruptSession() {
    if (!selectedSession || selectedSession.status !== "running") {
      return;
    }

    await runner.interrupt(selectedSession.id);
  }

  function handleStartWorkspaceSession(workspaceId: string) {
    dispatch({
      type: "workspace.new-session",
      workspaceId
    });
  }

  async function handleComposerKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (event.key !== "Enter" || !event.metaKey) {
      return;
    }

    event.preventDefault();

    if (composerDisabled || (composerValue.trim().length === 0 && composerAttachments.length === 0)) {
      return;
    }

    await handleComposerSubmit();
  }

  async function handleComposerPaste(
    event: React.ClipboardEvent<HTMLTextAreaElement>
  ) {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    const attachments = await Promise.all(imageFiles.map(readImageAttachment));
    setComposerAttachments((current) => [...current, ...attachments]);
  }

  function removeComposerAttachment(attachmentId: string) {
    setComposerAttachments((current) => {
      const attachment = current.find((candidate) => candidate.id === attachmentId);
      if (attachment) {
        URL.revokeObjectURL(attachment.previewUrl);
      }

      return current.filter((candidate) => candidate.id !== attachmentId);
    });
  }

  function toggleSystemNoteGroup(groupId: string) {
    setExpandedSystemNoteGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  function handleThemeChange(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    setIsSettingsOpen(false);
    setIsThemeMenuOpen(false);
  }

  async function handleModelSelection(nextModel: string) {
    if (!selectedSession) {
      setSelectedModel(nextModel);
      return;
    }

    if (selectedSession.model === nextModel) {
      setSelectedModel(nextModel);
      return;
    }

    await runner.setSessionModel({
      sessionId: selectedSession.id,
      model: nextModel,
      workspacePath: selectedWorkspace?.path ?? ""
    });

    dispatch({
      type: "session.model-changed",
      sessionId: selectedSession.id,
      model: nextModel
    });
    setSelectedModel(nextModel);
  }

  const composerDisabled =
    !selectedWorkspace || !selectedModel || selectedSession?.status === "running";
  const showComposer = state.workspaces.length > 0;
  const visibleActivities = selectedSession?.activities ?? [];
  const groupedActivities = groupActivities(visibleActivities);

  return (
    <div className="app-shell">
      <aside className="sidebar" style={{ width: `${sidebarWidth}px` }}>
        <div className="sidebar__inner">
          <div className="sidebar__header">
            <h1>Workspaces</h1>
            <button
              className="secondary-button secondary-button--compact"
              type="button"
              onClick={() => void handleAddWorkspace()}
              disabled={isAddingWorkspace}
            >
              {isAddingWorkspace ? "Adding..." : "Add Workspace"}
            </button>
          </div>

          <section className="sidebar__section sidebar__content">
            {state.workspaces.length === 0 ? (
              <div className="empty-card">
                <p>No workspaces yet.</p>
                <span>
                  A workspace is a local directory that Session Kid can use as the
                  home for its agent sessions.
                </span>
              </div>
            ) : (
              <div className="workspace-list">
                {state.workspaces.map((workspace) => {
                  const isSelected = workspace.id === state.selectedWorkspaceId;
                  const workspaceSessions = getSessionsForWorkspace(state.sessions, workspace.id);

                  return (
                    <section
                      key={workspace.id}
                      className={
                        isSelected
                          ? "workspace-card workspace-card--selected"
                          : "workspace-card"
                      }
                    >
                      <div className="workspace-card__header">
                        <button
                          className="workspace-card__button"
                          type="button"
                          onClick={() =>
                            dispatch({
                              type: "workspace.selected",
                              workspaceId: workspace.id
                            })
                          }
                        >
                          <strong>{workspace.name}</strong>
                          <span>{workspaceSessions.length} sessions</span>
                        </button>
                        <button
                          className="workspace-add-session"
                          type="button"
                          aria-label={`Start a new session in ${workspace.name}`}
                          onClick={() => handleStartWorkspaceSession(workspace.id)}
                        >
                          +
                        </button>
                      </div>

                      {workspaceSessions.length > 0 ? (
                        <div className="session-list">
                          {workspaceSessions.map((session) => {
                            const isActive = session.id === state.selectedSessionId;
                            return (
                              <button
                                key={session.id}
                                className={
                                  isActive
                                    ? "session-row session-row--selected"
                                    : "session-row"
                                }
                                type="button"
                                onClick={() =>
                                  dispatch({
                                    type: "session.selected",
                                    sessionId: session.id
                                  })
                                }
                              >
                                <div className="session-row__topline">
                                  <strong>{session.title}</strong>
                                  <span className={`status-dot status-dot--${session.status}`} />
                                </div>
                                <span className="session-row__meta">
                                  {formatSessionMeta(session)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </aside>

      <button
        type="button"
        className={isResizing ? "splitter splitter--active" : "splitter"}
        aria-label="Resize workspace sidebar"
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuemax={MAX_SIDEBAR_WIDTH}
        aria-valuenow={sidebarWidth}
        onPointerDown={startResize}
      />

      <main className="main-pane">
        <header className="main-pane__header">
          <h2>{selectedSession ? selectedSession.title : "No session selected"}</h2>
          <div className="main-pane__controls">
            <div className="context-chip">
              {selectedWorkspace ? selectedWorkspace.path : "No workspace attached"}
            </div>
            <div ref={settingsRef} className="settings-menu">
              <button
                className="settings-menu__trigger"
                type="button"
                aria-label="Open settings"
                aria-expanded={isSettingsOpen}
                onClick={() => {
                  setIsSettingsOpen((current) => {
                    const next = !current;
                    if (!next) {
                      setIsThemeMenuOpen(false);
                    }
                    return next;
                  });
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10.2 2h3.6l.56 2.44c.48.16.95.36 1.39.59l2.22-1.13 2.54 2.54-1.13 2.22c.23.44.43.91.59 1.39L22 10.2v3.6l-2.44.56a8.6 8.6 0 0 1-.59 1.39l1.13 2.22-2.54 2.54-2.22-1.13c-.44.23-.91.43-1.39.59L13.8 22h-3.6l-.56-2.44a8.6 8.6 0 0 1-1.39-.59l-2.22 1.13-2.54-2.54 1.13-2.22a8.6 8.6 0 0 1-.59-1.39L2 13.8v-3.6l2.44-.56c.16-.48.36-.95.59-1.39L3.9 6.03 6.44 3.5l2.22 1.13c.44-.23.91-.43 1.39-.59L10.2 2Zm1.8 6.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z" />
                </svg>
              </button>

              {isSettingsOpen ? (
                <div className="settings-menu__panel">
                  <button
                    className="settings-menu__item"
                    type="button"
                    aria-expanded={isThemeMenuOpen}
                    onClick={() => setIsThemeMenuOpen((current) => !current)}
                  >
                    <span>Theme</span>
                    <span className="settings-menu__value">{theme}</span>
                  </button>

                  {isThemeMenuOpen ? (
                    <div className="settings-submenu">
                      {themeOptions.map((option) => (
                        <button
                          key={option}
                          className={
                            option === theme
                              ? "settings-submenu__item settings-submenu__item--active"
                              : "settings-submenu__item"
                          }
                          type="button"
                          onClick={() => handleThemeChange(option)}
                        >
                          <span>{option}</span>
                          {option === theme ? <span>✓</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section ref={feedRef} className="feed">
          {selectedSession ? (
            <div className="feed__content">
              {groupedActivities.map((group) => {
                if (group.type === "single") {
                  const { activity } = group;
                  return (
                    <article
                      key={activity.id}
                      className={`activity-log activity-log--${activity.kind}`}
                      title={formatActivityTooltip(activity.timestamp)}
                    >
                      <ActivityContent kind={activity.kind} text={activity.text} />
                    </article>
                  );
                }

                const isExpanded = expandedSystemNoteGroups.has(group.id);
                const first = group.activities[0];
                const last = group.activities[group.activities.length - 1];

                return (
                  <article
                    key={group.id}
                    className="activity-log activity-log--system-note-group"
                  >
                    <button
                      className="system-note-toggle"
                      type="button"
                      onClick={() => toggleSystemNoteGroup(group.id)}
                      aria-expanded={isExpanded}
                      title={formatActivityTooltip(last.timestamp)}
                    >
                      <div className="system-note-toggle__row">
                        <span className="system-note-toggle__summary">
                          {summarizeSystemNote(first.text)}
                        </span>
                        <span className="system-note-toggle__meta">
                          {group.activities.length > 1 ? `${group.activities.length} notes` : "1 note"}
                        </span>
                        <span className="system-note-toggle__chevron" aria-hidden="true">
                          {isExpanded ? "▴" : "▾"}
                        </span>
                      </div>
                    </button>
                    
                    {isExpanded ? (
                      <div className="system-note-list">
                        {group.activities.map((activity) => (
                          <div
                            key={activity.id}
                            className="system-note-list__item"
                            title={formatActivityTooltip(activity.timestamp)}
                          >
                            <ActivityContent kind={activity.kind} text={activity.text} />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="feed__hero">
              <p className="feed__lead">
                Codex is the first provider, but the app state is already
                provider-neutral.
              </p>
              <h3>
                {selectedWorkspace
                  ? "Start a session in this workspace."
                  : "Add a workspace, then start the first session."}
              </h3>
              <p className="feed__body">
                The app now has an explicit session model, a runner boundary, and a
                Codex-specific adapter layer that can later be matched with another
                provider.
              </p>
            </div>
          )}
        </section>

        {showComposer ? (
          <footer className="composer">
            <div className="composer__toolbar">
              <div className="composer__actions">
                <button
                  className="ghost-button ghost-button--wide"
                  type="button"
                  disabled
                >
                  Attach Context
                </button>
                <button
                  className="ghost-button ghost-button--wide"
                  type="button"
                  onClick={() => void handleInterruptSession()}
                  disabled={selectedSession?.status !== "running"}
                >
                  Interrupt
                </button>
              </div>
              <label className="model-select">
                <span>Model</span>
                <select
                  value={selectedModel}
                  disabled={availableModels.length === 0}
                  onChange={(event) => void handleModelSelection(event.target.value)}
                >
                  {availableModels.length === 0 ? (
                    <option value="">No models available</option>
                  ) : (
                    availableModels.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.displayName}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>
            <div className="composer__body">
              {composerAttachments.length > 0 ? (
                <div className="composer-attachments">
                  {composerAttachments.map((attachment) => (
                    <div key={attachment.id} className="composer-attachment">
                      <img src={attachment.previewUrl} alt="" />
                      <button
                        className="composer-attachment__remove"
                        type="button"
                        aria-label={`Remove ${attachment.name}`}
                        onClick={() => removeComposerAttachment(attachment.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <textarea
                value={composerValue}
                onChange={(event) => setComposerValue(event.target.value)}
                onKeyDown={(event) => void handleComposerKeyDown(event)}
                onPaste={(event) => void handleComposerPaste(event)}
                placeholder={
                  selectedSession
                    ? "Continue this session with another message. Paste images with Command+V."
                    : "Start a new Codex session in the selected workspace. Paste images with Command+V."
                }
                rows={4}
              />
            </div>
          </footer>
        ) : null}
      </main>
    </div>
  );
}
