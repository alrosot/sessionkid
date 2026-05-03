import type { Session, SessionEvent, SessionStatus, TrayState, Workspace } from "./types";

export type SessionAppState = {
  workspaces: Workspace[];
  sessions: Session[];
  selectedWorkspaceId: string | null;
  selectedSessionId: string | null;
};

export type SessionAppAction =
  | { type: "hydrate"; state: SessionAppState }
  | { type: "workspace.added"; workspace: Workspace }
  | { type: "workspace.selected"; workspaceId: string }
  | { type: "workspace.new-session"; workspaceId: string }
  | { type: "session.selected"; sessionId: string }
  | { type: "session.model-changed"; sessionId: string; model: string }
  | { type: "runner.event"; event: SessionEvent };

export const emptySessionAppState: SessionAppState = {
  workspaces: [],
  sessions: [],
  selectedWorkspaceId: null,
  selectedSessionId: null
};

const HIDDEN_ACTIVITY_TEXT = "Codex finished this turn and returned to idle.";

function isSessionStatus(value: unknown): value is SessionStatus {
  return (
    value === "idle" ||
    value === "running" ||
    value === "waiting-for-user-input" ||
    value === "error"
  );
}

function sanitizeSession(session: Session): Session {
  const status =
    session.status === "running" || session.status === "waiting-for-user-input"
      ? "idle"
      : session.status;

  return {
    ...session,
    status,
    activities: Array.isArray(session.activities) ? session.activities : []
  };
}

export function parseStoredSessionAppState(raw: string | null): SessionAppState {
  if (!raw) {
    return emptySessionAppState;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SessionAppState>;
    const workspaces = Array.isArray(parsed.workspaces) ? parsed.workspaces : [];
    const sessions = Array.isArray(parsed.sessions)
      ? parsed.sessions
          .filter(
            (session): session is Session =>
              typeof session === "object" &&
              session !== null &&
              typeof session.id === "string" &&
              typeof session.workspaceId === "string" &&
              isSessionStatus(session.status)
          )
          .map(sanitizeSession)
      : [];

    const selectedWorkspaceId =
      typeof parsed.selectedWorkspaceId === "string" ? parsed.selectedWorkspaceId : null;
    const selectedSessionId =
      typeof parsed.selectedSessionId === "string" ? parsed.selectedSessionId : null;

    return {
      workspaces,
      sessions,
      selectedWorkspaceId:
        selectedWorkspaceId && workspaces.some((workspace) => workspace.id === selectedWorkspaceId)
          ? selectedWorkspaceId
          : workspaces[0]?.id ?? null,
      selectedSessionId:
        selectedSessionId && sessions.some((session) => session.id === selectedSessionId)
          ? selectedSessionId
          : sessions[0]?.id ?? null
    };
  } catch {
    return emptySessionAppState;
  }
}

export function deriveTrayState(sessions: Session[]): TrayState {
  if (sessions.some((session) => session.status === "error")) {
    return "error";
  }

  if (sessions.some((session) => session.status === "waiting-for-user-input")) {
    return "waiting-for-user-input";
  }

  if (sessions.some((session) => session.status === "running")) {
    return "running";
  }

  return "idle";
}

export function getSessionsForWorkspace(
  sessions: Session[],
  workspaceId: string
): Session[] {
  return sessions
    .filter((session) => session.workspaceId === workspaceId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function truncateSessionSummary(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 40) {
    return trimmed;
  }

  return `${trimmed.slice(0, 37)}...`;
}

function titleFromPrompt(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 56) {
    return trimmed;
  }

  return `${trimmed.slice(0, 53)}...`;
}

function patchSession(
  sessions: Session[],
  sessionId: string,
  update: (session: Session) => Session
): Session[] {
  return sessions.map((session) =>
    session.id === sessionId ? update(session) : session
  );
}

function shouldPersistActivity(text: string): boolean {
  return text.trim() !== HIDDEN_ACTIVITY_TEXT;
}

function appendActivity(session: Session, event: SessionEvent): Session {
  if (!("activity" in event)) {
    return session;
  }

  if (!shouldPersistActivity(event.activity.text)) {
    return {
      ...session,
      updatedAt: event.activity.timestamp
    };
  }

  return {
    ...session,
    updatedAt: event.activity.timestamp,
    activities: [...session.activities, event.activity]
  };
}

export function sessionAppReducer(
  state: SessionAppState,
  action: SessionAppAction
): SessionAppState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "workspace.added":
      return {
        ...state,
        workspaces: [...state.workspaces, action.workspace],
        selectedWorkspaceId: action.workspace.id,
        selectedSessionId: null
      };
    case "workspace.selected": {
      const sessions = getSessionsForWorkspace(state.sessions, action.workspaceId);
      return {
        ...state,
        selectedWorkspaceId: action.workspaceId,
        selectedSessionId:
          sessions.find((session) => session.id === state.selectedSessionId)?.id ??
          sessions[0]?.id ??
          null
      };
    }
    case "workspace.new-session":
      return {
        ...state,
        selectedWorkspaceId: action.workspaceId,
        selectedSessionId: null
      };
    case "session.selected": {
      const session = state.sessions.find((candidate) => candidate.id === action.sessionId);
      if (!session) {
        return state;
      }

      return {
        ...state,
        selectedWorkspaceId: session.workspaceId,
        selectedSessionId: session.id
      };
    }
    case "session.model-changed":
      return {
        ...state,
        sessions: patchSession(state.sessions, action.sessionId, (session) => ({
          ...session,
          model: action.model
        }))
      };
    case "runner.event": {
      const { event } = action;

      if (event.type === "session.started") {
        const session = {
          ...event.session,
          title: titleFromPrompt(event.session.title),
          summary: truncateSessionSummary(event.session.summary)
        };

        return {
          ...state,
          sessions: [session, ...state.sessions],
          selectedWorkspaceId: session.workspaceId,
          selectedSessionId: session.id
        };
      }

      if (event.type === "session.progress") {
        return {
          ...state,
          sessions: patchSession(state.sessions, event.sessionId, (session) => ({
            ...appendActivity(session, event),
            status: "running"
          }))
        };
      }

      if (event.type === "session.input_received") {
        return {
          ...state,
          sessions: patchSession(state.sessions, event.sessionId, (session) => ({
            ...appendActivity(session, event),
            status: "running"
          })),
          selectedSessionId: event.sessionId
        };
      }

      if (event.type === "session.waiting_for_input") {
        return {
          ...state,
          sessions: patchSession(state.sessions, event.sessionId, (session) => ({
            ...appendActivity(session, event),
            status: "waiting-for-user-input"
          })),
          selectedSessionId: event.sessionId
        };
      }

      if (event.type === "session.completed") {
        return {
          ...state,
          sessions: patchSession(state.sessions, event.sessionId, (session) => ({
            ...appendActivity(session, event),
            status: "idle"
          }))
        };
      }

      if (event.type === "session.failed") {
        return {
          ...state,
          sessions: patchSession(state.sessions, event.sessionId, (session) => ({
            ...appendActivity(session, event),
            status: "error"
          })),
          selectedSessionId: event.sessionId
        };
      }

      return state;
    }
    default:
      return state;
  }
}
