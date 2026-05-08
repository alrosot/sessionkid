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

export type SessionModelOption = {
  id: string;
  displayName: string;
  inputModalities: string[];
  isDefault: boolean;
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

export type SessionApprovalDecision =
  | "approve"
  | "approve-for-session"
  | "deny"
  | "cancel";

export type SessionPendingRequest =
  | {
      type: "user-input";
      prompt: string;
    }
  | {
      type: "approval";
      approvalType: "command" | "file-change" | "permissions";
      prompt: string;
      command: string | null;
      cwd: string | null;
      options: SessionApprovalDecision[];
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
  pendingRequest: SessionPendingRequest | null;
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

export type SessionModelSelection = {
  sessionId: string;
  model: string;
  workspacePath: string;
};

export type SendSessionInput = {
  sessionId: string;
  input: string;
  model: string;
  workspacePath: string;
  attachments?: PromptImageAttachment[];
};

export type RespondToApprovalInput = {
  sessionId: string;
  decision: SessionApprovalDecision;
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
      pendingRequest: SessionPendingRequest;
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
