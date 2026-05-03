export type ProviderId = "codex";

export type SessionStatus =
  | "idle"
  | "running"
  | "waiting-for-user-input"
  | "error";

export type TrayState = SessionStatus;

export type Workspace = {
  id: string;
  name: string;
  path: string;
};

export type PromptImageAttachment = {
  id: string;
  name: string;
  mimeType: string;
  bytes: number[];
  previewUrl: string;
};

export type SessionActivityKind =
  | "user-message"
  | "assistant-update"
  | "system-note"
  | "file-activity";

export type SessionActivity = {
  id: string;
  kind: SessionActivityKind;
  text: string;
  timestamp: string;
};

export type Session = {
  id: string;
  workspaceId: string;
  provider: ProviderId;
  title: string;
  summary: string;
  model: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  activities: SessionActivity[];
};

export type StartSessionInput = {
  workspace: Workspace;
  prompt: string;
  model: string;
  attachments?: PromptImageAttachment[];
};

export type SessionHandle = {
  sessionId: string;
};

export type SendSessionInput = {
  sessionId: string;
  input: string;
  attachments?: PromptImageAttachment[];
};

export type SessionEvent =
  | {
      type: "session.started";
      session: Session;
    }
  | {
      type: "session.progress";
      sessionId: string;
      activity: SessionActivity;
    }
  | {
      type: "session.waiting_for_input";
      sessionId: string;
      activity: SessionActivity;
    }
  | {
      type: "session.completed";
      sessionId: string;
      activity: SessionActivity;
    }
  | {
      type: "session.failed";
      sessionId: string;
      activity: SessionActivity;
    }
  | {
      type: "session.input_received";
      sessionId: string;
      activity: SessionActivity;
    };
