import type {
  SessionEvent,
  SessionHandle,
  StartSessionInput
} from "./types";

export interface SessionRunner {
  startSession(input: StartSessionInput): Promise<SessionHandle>;
  sendInput(sessionId: string, input: string): Promise<void>;
  interrupt(sessionId: string): Promise<void>;
  resume(sessionId: string): Promise<void>;
  dispose(sessionId: string): Promise<void>;
  subscribe(listener: (event: SessionEvent) => void): () => void;
}
