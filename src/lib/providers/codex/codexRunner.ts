import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SessionRunner } from "../../session/runner";
import type {
  SessionEvent,
  SessionHandle,
  StartSessionInput
} from "../../session/types";

type CodexStartSessionOutput = {
  sessionId: string;
};

export class CodexRunner implements SessionRunner {
  private listeners = new Set<(event: SessionEvent) => void>();
  private unlistenPromise: Promise<UnlistenFn> | null = null;

  subscribe(listener: (event: SessionEvent) => void): () => void {
    this.listeners.add(listener);

    if (!this.unlistenPromise) {
      this.unlistenPromise = listen<SessionEvent>("codex-session-event", (event) => {
        this.listeners.forEach((currentListener) => currentListener(event.payload));
      });
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  async startSession(input: StartSessionInput): Promise<SessionHandle> {
    const result = await invoke<CodexStartSessionOutput>("codex_start_session", {
      input: {
        workspaceId: input.workspace.id,
        workspacePath: input.workspace.path,
        prompt: input.prompt,
        model: input.model
      }
    });

    return {
      sessionId: result.sessionId
    };
  }

  async sendInput(sessionId: string, input: string): Promise<void> {
    await invoke("codex_send_input", {
      input: {
        sessionId,
        input
      }
    });
  }

  async interrupt(sessionId: string): Promise<void> {
    await invoke("codex_interrupt_session", {
      input: {
        sessionId
      }
    });
  }

  async resume(sessionId: string): Promise<void> {
    await this.sendInput(sessionId, "Resume the previous task.");
  }

  async dispose(sessionId: string): Promise<void> {
    await invoke("codex_dispose_session", {
      input: {
        sessionId
      }
    });
  }
}
