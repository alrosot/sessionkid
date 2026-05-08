import type {
  RespondToApprovalInput,
  SendSessionInput,
  SessionEvent,
  SessionHandle,
  SessionModelSelection,
  StartSessionInput
} from "./types";

export interface SessionRunner {
  startSession(input: StartSessionInput): Promise<SessionHandle>;
  setSessionModel(input: SessionModelSelection): Promise<void>;
  sendInput(input: SendSessionInput): Promise<void>;
  respondToApproval(input: RespondToApprovalInput): Promise<void>;
  interrupt(sessionId: string): Promise<void>;
  resume(sessionId: string): Promise<void>;
  dispose(sessionId: string): Promise<void>;
  subscribe(listener: (event: SessionEvent) => void): () => void;
}
