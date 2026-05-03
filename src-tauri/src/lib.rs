use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
  collections::HashMap,
  fs,
  io::{BufRead, BufReader, Write},
  path::PathBuf,
  process::{Child, ChildStderr, ChildStdin, ChildStdout, Command, Stdio},
  sync::{
    atomic::{AtomicU64, Ordering},
    mpsc, Arc, Mutex
  },
  time::Duration
};
use tauri::{
  menu::{MenuBuilder, MenuItemBuilder},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  AppHandle, Emitter, Manager, State
};
use tauri_plugin_notification::NotificationExt;

const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_ID: &str = "main-tray";
const MENU_OPEN: &str = "open";
const MENU_QUIT: &str = "quit";
const CODEX_EVENT_NAME: &str = "codex-session-event";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const SESSION_STATE_FILE: &str = "session-state.json";

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
enum TrayState {
  Idle,
  Running,
  WaitingForUserInput,
  Error
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodexStartSessionInput {
  workspace_id: String,
  workspace_path: String,
  prompt: String,
  model: String,
  attachments: Vec<CodexImageAttachment>
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodexSessionInput {
  session_id: String,
  input: String,
  model: String,
  workspace_path: String,
  attachments: Vec<CodexImageAttachment>
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodexImageAttachment {
  id: String,
  name: String,
  mime_type: String,
  bytes: Vec<u8>
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodexSessionRef {
  session_id: String
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodexSessionModelInput {
  session_id: String,
  model: String,
  workspace_path: String
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexStartSessionOutput {
  session_id: String
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexModelOption {
  id: String,
  display_name: String,
  input_modalities: Vec<String>,
  is_default: bool
}

#[derive(Debug)]
struct PendingUserInputRequest {
  request_id: u64,
  question_ids: Vec<String>
}

#[derive(Debug)]
struct SessionRuntime {
  thread_id: String,
  current_turn_id: Option<String>,
  pending_user_input: Option<PendingUserInputRequest>
}

#[derive(Default)]
struct CodexService {
  client: Option<CodexAppServer>,
  sessions: Arc<Mutex<HashMap<String, SessionRuntime>>>
}

#[derive(Default)]
struct AppState {
  codex: Mutex<CodexService>
}

struct CodexAppServer {
  child: Child,
  stdin: Arc<Mutex<ChildStdin>>,
  pending: Arc<Mutex<HashMap<u64, mpsc::Sender<Result<Value, String>>>>>,
  next_id: AtomicU64
}

impl TrayState {
  fn menu_bar_label(self) -> &'static str {
    match self {
      Self::Idle => "SK",
      Self::Running => "SK•",
      Self::WaitingForUserInput => "SK!",
      Self::Error => "SK×"
    }
  }

  fn tooltip(self) -> &'static str {
    match self {
      Self::Idle => "Session Kid: idle",
      Self::Running => "Session Kid: sessions running",
      Self::WaitingForUserInput => "Session Kid: waiting for user input",
      Self::Error => "Session Kid: session error"
    }
  }

  fn notification_body(self) -> Option<&'static str> {
    match self {
      Self::WaitingForUserInput => Some("A session is waiting for your input."),
      _ => None
    }
  }
}

impl CodexAppServer {
  fn spawn(
    app: &AppHandle,
    sessions: Arc<Mutex<HashMap<String, SessionRuntime>>>
  ) -> Result<Self, String> {
    let mut child = Command::new("codex")
      .args(["app-server"])
      .stdin(Stdio::piped())
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .spawn()
      .map_err(|error| format!("failed to launch codex app-server: {error}"))?;

    let stdin = child
      .stdin
      .take()
      .ok_or_else(|| "failed to open codex app-server stdin".to_string())?;
    let stdout = child
      .stdout
      .take()
      .ok_or_else(|| "failed to open codex app-server stdout".to_string())?;
    let stderr = child
      .stderr
      .take()
      .ok_or_else(|| "failed to open codex app-server stderr".to_string())?;

    let pending = Arc::new(Mutex::new(HashMap::new()));
    let stdin = Arc::new(Mutex::new(stdin));

    Self::start_stdout_reader(
      app.clone(),
      stdout,
      stdin.clone(),
      pending.clone(),
      sessions
    );
    Self::start_stderr_reader(stderr);

    let server = Self {
      child,
      stdin,
      pending,
      next_id: AtomicU64::new(1)
    };

    server.initialize()?;
    Ok(server)
  }

  fn initialize(&self) -> Result<(), String> {
    self.send_request(
      "initialize",
      json!({
        "clientInfo": {
          "name": "session_kid",
          "title": "Session Kid",
          "version": "0.1.0"
        },
        "capabilities": {
          "experimentalApi": true
        }
      })
    )?;

    self.send_notification("initialized", json!({}))
  }

  fn send_request(&self, method: &str, params: Value) -> Result<Value, String> {
    let id = self.next_id.fetch_add(1, Ordering::SeqCst);
    let (tx, rx) = mpsc::channel();
    self
      .pending
      .lock()
      .map_err(|_| "codex app-server pending map was poisoned".to_string())?
      .insert(id, tx);

    let message = json!({
      "method": method,
      "id": id,
      "params": params
    });

    if let Err(error) = self.write_message(&message) {
      let _ = self
        .pending
        .lock()
        .map_err(|_| "codex app-server pending map was poisoned".to_string())?
        .remove(&id);
      return Err(error);
    }

    rx.recv_timeout(REQUEST_TIMEOUT)
      .map_err(|_| format!("timed out waiting for codex app-server response to {method}"))?
  }

  fn send_notification(&self, method: &str, params: Value) -> Result<(), String> {
    self.write_message(&json!({
      "method": method,
      "params": params
    }))
  }

  fn send_response(&self, id: u64, result: Value) -> Result<(), String> {
    self.write_message(&json!({
      "id": id,
      "result": result
    }))
  }

  fn write_message(&self, message: &Value) -> Result<(), String> {
    let mut stdin = self
      .stdin
      .lock()
      .map_err(|_| "codex app-server stdin was poisoned".to_string())?;
    writeln!(stdin, "{message}")
      .and_then(|_| stdin.flush())
      .map_err(|error| format!("failed to write to codex app-server: {error}"))
  }

  fn start_stdout_reader(
    app: AppHandle,
    stdout: ChildStdout,
    stdin: Arc<Mutex<ChildStdin>>,
    pending: Arc<Mutex<HashMap<u64, mpsc::Sender<Result<Value, String>>>>>,
    sessions: Arc<Mutex<HashMap<String, SessionRuntime>>>
  ) {
    std::thread::spawn(move || {
      let reader = BufReader::new(stdout);
      for line in reader.lines() {
        let Ok(line) = line else {
          continue;
        };

        if line.trim().is_empty() {
          continue;
        }

        let Ok(message) = serde_json::from_str::<Value>(&line) else {
          continue;
        };

        let has_method = message.get("method").and_then(Value::as_str);
        let id = message.get("id").and_then(Value::as_u64);

        match (has_method, id) {
          (Some(method), Some(request_id)) => {
            Self::handle_server_request(
              &app,
              &stdin,
              &sessions,
              request_id,
              method,
              message.get("params").cloned().unwrap_or_else(|| json!({}))
            );
          }
          (Some(method), None) => {
            Self::handle_notification(
              &app,
              &sessions,
              method,
              message.get("params").cloned().unwrap_or_else(|| json!({}))
            );
          }
          (None, Some(response_id)) => {
            let sender = pending
              .lock()
              .ok()
              .and_then(|mut pending_map| pending_map.remove(&response_id));
            if let Some(sender) = sender {
              if let Some(error) = message.get("error") {
                let detail = error
                  .get("message")
                  .and_then(Value::as_str)
                  .unwrap_or("unknown app-server error")
                  .to_string();
                let _ = sender.send(Err(detail));
              } else {
                let _ = sender.send(Ok(
                  message.get("result").cloned().unwrap_or_else(|| json!({}))
                ));
              }
            }
          }
          _ => {}
        }
      }
    });
  }

  fn start_stderr_reader(stderr: ChildStderr) {
    std::thread::spawn(move || {
      let reader = BufReader::new(stderr);
      for line in reader.lines() {
        if let Ok(line) = line {
          eprintln!("codex app-server: {line}");
        }
      }
    });
  }

  fn handle_server_request(
    app: &AppHandle,
    stdin: &Arc<Mutex<ChildStdin>>,
    sessions: &Arc<Mutex<HashMap<String, SessionRuntime>>>,
    request_id: u64,
    method: &str,
    params: Value
  ) {
    if method == "item/tool/requestUserInput" {
      let thread_id = params
        .get("threadId")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

      let question_ids: Vec<String> = params
        .get("questions")
        .and_then(Value::as_array)
        .map(|questions| {
          questions
            .iter()
            .filter_map(|question| question.get("id").and_then(Value::as_str).map(str::to_string))
            .collect()
        })
        .unwrap_or_default();

      let question_text = params
        .get("questions")
        .and_then(Value::as_array)
        .map(|questions| {
          questions
            .iter()
            .filter_map(|question| question.get("question").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join(" ")
        })
        .unwrap_or_else(|| "Codex is waiting for your input.".to_string());

      if let Ok(mut session_map) = sessions.lock() {
        if let Some(runtime) = session_map.get_mut(&thread_id) {
          runtime.pending_user_input = Some(PendingUserInputRequest {
            request_id,
            question_ids
          });
        }
      }

      emit_waiting_for_input(app, &thread_id, &question_text);
      return;
    }

    let _ = write_json_line(
      stdin,
      &json!({
        "id": request_id,
        "error": {
          "code": -32601,
          "message": format!("unsupported server request: {method}")
        }
      })
    );
  }

  fn handle_notification(
    app: &AppHandle,
    sessions: &Arc<Mutex<HashMap<String, SessionRuntime>>>,
    method: &str,
    params: Value
  ) {
    match method {
      "turn/started" => {
        let thread_id = params
          .get("threadId")
          .and_then(Value::as_str)
          .unwrap_or_default()
          .to_string();
        let turn_id = params
          .get("turn")
          .and_then(|turn| turn.get("id"))
          .and_then(Value::as_str)
          .unwrap_or_default()
          .to_string();

        if let Ok(mut session_map) = sessions.lock() {
          if let Some(runtime) = session_map.get_mut(&thread_id) {
            runtime.current_turn_id = Some(turn_id);
          }
        }
      }
      "item/completed" => {
        let thread_id = params
          .get("threadId")
          .and_then(Value::as_str)
          .unwrap_or_default()
          .to_string();
        let item = params.get("item").cloned().unwrap_or_else(|| json!({}));
        Self::emit_item_completed(app, &thread_id, &item);
      }
      "turn/completed" => {
        let thread_id = params
          .get("threadId")
          .and_then(Value::as_str)
          .unwrap_or_default()
          .to_string();
        let status = params
          .get("turn")
          .and_then(|turn| turn.get("status"))
          .and_then(Value::as_str)
          .unwrap_or_default();
        let error_message = params
          .get("turn")
          .and_then(|turn| turn.get("error"))
          .and_then(|error| error.get("message"))
          .and_then(Value::as_str);

        if let Ok(mut session_map) = sessions.lock() {
          if let Some(runtime) = session_map.get_mut(&thread_id) {
            runtime.current_turn_id = None;
          }
        }

        match status {
          "completed" => emit_completed(
            app,
            &thread_id,
            "Codex finished this turn and returned to idle."
          ),
          "failed" => emit_failed(
            app,
            &thread_id,
            error_message.unwrap_or("Codex failed to complete this turn.")
          ),
          _ => {}
        }
      }
      "error" => {
        let thread_id = params
          .get("threadId")
          .and_then(Value::as_str)
          .unwrap_or_default()
          .to_string();
        let message = params
          .get("error")
          .and_then(|error| error.get("message"))
          .and_then(Value::as_str)
          .unwrap_or("Codex app-server reported an error.");

        if !thread_id.is_empty() {
          emit_failed(app, &thread_id, message);
        }
      }
      _ => {}
    }
  }

  fn emit_item_completed(app: &AppHandle, thread_id: &str, item: &Value) {
    let item_type = item.get("type").and_then(Value::as_str).unwrap_or_default();

    match item_type {
      "agentMessage" => {
        let text = item.get("text").and_then(Value::as_str).unwrap_or_default();
        if !text.trim().is_empty() {
          emit_progress(app, thread_id, "assistant-update", text);
        }
      }
      "fileChange" => {
        let description = item
          .get("changes")
          .and_then(Value::as_array)
          .map(|changes| {
            let paths = changes
              .iter()
              .filter_map(|change| change.get("path").and_then(Value::as_str))
              .collect::<Vec<_>>();

            if paths.is_empty() {
              "Codex applied file changes.".to_string()
            } else {
              format!("Codex updated {}", paths.join(", "))
            }
          })
          .unwrap_or_else(|| "Codex applied file changes.".to_string());
        emit_progress(app, thread_id, "file-activity", &description);
      }
      "commandExecution" => {
        let command = item.get("command").and_then(Value::as_str).unwrap_or("command");
        let status = item.get("status").and_then(Value::as_str).unwrap_or_default();
        let description = match status {
          "failed" => format!("Command failed: {command}"),
          "completed" => format!("Ran command: {command}"),
          _ => format!("Command update: {command}")
        };
        emit_progress(app, thread_id, "system-note", &description);
      }
      _ => {}
    }
  }
}

impl Drop for CodexAppServer {
  fn drop(&mut self) {
    let _ = self.child.kill();
  }
}

fn write_json_line(stdin: &Arc<Mutex<ChildStdin>>, message: &Value) -> Result<(), String> {
  let mut stdin = stdin
    .lock()
    .map_err(|_| "codex app-server stdin was poisoned".to_string())?;
  writeln!(stdin, "{message}")
    .and_then(|_| stdin.flush())
    .map_err(|error| format!("failed to write to codex app-server: {error}"))
}

fn timestamp() -> String {
  Utc::now().to_rfc3339()
}

fn activity(kind: &str, text: &str) -> Value {
  json!({
    "id": format!("activity-{}", Utc::now().timestamp_nanos_opt().unwrap_or_default()),
    "kind": kind,
    "text": text,
    "timestamp": timestamp()
  })
}

fn describe_user_input(text: &str, attachment_count: usize) -> String {
  let trimmed = text.trim();
  let attachment_text = match attachment_count {
    0 => None,
    1 => Some("[Attached 1 image]".to_string()),
    count => Some(format!("[Attached {count} images]"))
  };

  match (trimmed.is_empty(), attachment_text) {
    (false, Some(attachment_text)) => format!("{trimmed}\n\n{attachment_text}"),
    (false, None) => trimmed.to_string(),
    (true, Some(attachment_text)) => attachment_text,
    (true, None) => String::new()
  }
}

fn default_session_prompt(text: &str, attachment_count: usize) -> String {
  let trimmed = text.trim();
  if !trimmed.is_empty() {
    return trimmed.to_string();
  }

  match attachment_count {
    0 => "New session".to_string(),
    1 => "Image prompt".to_string(),
    count => format!("{count} image prompt")
  }
}

fn image_extension(mime_type: &str) -> &'static str {
  match mime_type {
    "image/png" => "png",
    "image/jpeg" => "jpg",
    "image/webp" => "webp",
    "image/gif" => "gif",
    "image/heic" => "heic",
    "image/heif" => "heif",
    _ => "img"
  }
}

fn write_attachment_to_temp(attachment: &CodexImageAttachment) -> Result<PathBuf, String> {
  let extension = image_extension(&attachment.mime_type);
  let path = std::env::temp_dir().join(format!(
    "session-kid-{}-{}.{}",
    Utc::now().timestamp_millis(),
    attachment.id,
    extension
  ));

  fs::write(&path, &attachment.bytes)
    .map_err(|error| format!("failed to write attachment {}: {error}", attachment.name))?;

  Ok(path)
}

fn build_turn_input(
  text: &str,
  attachments: &[CodexImageAttachment]
) -> Result<Vec<Value>, String> {
  let mut input = Vec::new();

  for attachment in attachments {
    let path = write_attachment_to_temp(attachment)?;
    input.push(json!({
      "type": "localImage",
      "path": path
    }));
  }

  if !text.trim().is_empty() {
    input.push(json!({
      "type": "text",
      "text": text,
      "text_elements": []
    }));
  }

  if input.is_empty() {
    return Err("empty prompt".to_string());
  }

  Ok(input)
}

fn ensure_session_runtime<'a>(
  client: &CodexAppServer,
  sessions: &'a mut HashMap<String, SessionRuntime>,
  session_id: &str,
  workspace_path: &str,
  model: &str
) -> Result<&'a mut SessionRuntime, String> {
  if !sessions.contains_key(session_id) {
    client.send_request(
      "thread/resume",
      json!({
        "threadId": session_id,
        "cwd": workspace_path,
        "model": model
      })
    )?;

    sessions.insert(
      session_id.to_string(),
      SessionRuntime {
        thread_id: session_id.to_string(),
        current_turn_id: None,
        pending_user_input: None
      }
    );
  }

  sessions
    .get_mut(session_id)
    .ok_or_else(|| "unknown session id".to_string())
}

fn emit_event(app: &AppHandle, payload: Value) {
  let _ = app.emit(CODEX_EVENT_NAME, payload);
}

fn emit_started(app: &AppHandle, input: &CodexStartSessionInput, session_id: &str) {
  let prompt = default_session_prompt(&input.prompt, input.attachments.len());
  let activity_text = describe_user_input(&input.prompt, input.attachments.len());
  emit_event(
    app,
    json!({
      "type": "session.started",
      "session": {
        "id": session_id,
        "workspaceId": input.workspace_id,
        "provider": "codex",
        "title": prompt,
        "summary": prompt,
        "model": input.model,
        "status": "running",
        "createdAt": timestamp(),
        "updatedAt": timestamp(),
        "activities": [activity("user-message", &activity_text)]
      }
    })
  );
}

fn emit_progress(app: &AppHandle, session_id: &str, kind: &str, text: &str) {
  emit_event(
    app,
    json!({
      "type": "session.progress",
      "sessionId": session_id,
      "activity": activity(kind, text)
    })
  );
}

fn emit_input_received(
  app: &AppHandle,
  session_id: &str,
  text: &str,
  attachment_count: usize
) {
  let activity_text = describe_user_input(text, attachment_count);
  emit_event(
    app,
    json!({
      "type": "session.input_received",
      "sessionId": session_id,
      "activity": activity("user-message", &activity_text)
    })
  );
}

fn emit_waiting_for_input(app: &AppHandle, session_id: &str, text: &str) {
  emit_event(
    app,
    json!({
      "type": "session.waiting_for_input",
      "sessionId": session_id,
      "activity": activity("assistant-update", text)
    })
  );
}

fn emit_completed(app: &AppHandle, session_id: &str, text: &str) {
  emit_event(
    app,
    json!({
      "type": "session.completed",
      "sessionId": session_id,
      "activity": activity("system-note", text)
    })
  );
}

fn emit_failed(app: &AppHandle, session_id: &str, text: &str) {
  emit_event(
    app,
    json!({
      "type": "session.failed",
      "sessionId": session_id,
      "activity": activity("system-note", text)
    })
  );
}

fn show_main_window(app: &AppHandle) -> tauri::Result<()> {
  if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
    window.show()?;
    window.unminimize()?;
    window.set_focus()?;
  }

  Ok(())
}

fn apply_tray_state(app: &AppHandle, state: TrayState) -> tauri::Result<()> {
  if let Some(tray) = app.tray_by_id(TRAY_ID) {
    tray.set_title(Some(state.menu_bar_label()))?;
    tray.set_tooltip(Some(state.tooltip()))?;
  }

  let _ = app.emit("tray-state-changed", state);
  Ok(())
}

fn session_state_path(app: &AppHandle) -> Result<PathBuf, String> {
  let app_data_dir = app
    .path()
    .app_data_dir()
    .map_err(|error| format!("failed to resolve app data directory: {error}"))?;

  fs::create_dir_all(&app_data_dir)
    .map_err(|error| format!("failed to create app data directory: {error}"))?;

  Ok(app_data_dir.join(SESSION_STATE_FILE))
}

#[tauri::command]
fn set_tray_state(app: AppHandle, state: TrayState) -> Result<(), String> {
  apply_tray_state(&app, state).map_err(|error| error.to_string())?;

  if let Some(body) = state.notification_body() {
    app
      .notification()
      .builder()
      .title("Session Kid")
      .body(body)
      .show()
      .map_err(|error| error.to_string())?;
  }

  Ok(())
}

#[tauri::command]
fn reveal_main_window(app: AppHandle) -> Result<(), String> {
  show_main_window(&app).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_session_state(app: AppHandle) -> Result<Option<String>, String> {
  let path = session_state_path(&app)?;
  match fs::read_to_string(path) {
    Ok(state) => Ok(Some(state)),
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
    Err(error) => Err(format!("failed to read session state: {error}"))
  }
}

#[tauri::command]
fn save_session_state(app: AppHandle, state_json: String) -> Result<(), String> {
  let path = session_state_path(&app)?;
  fs::write(path, state_json).map_err(|error| format!("failed to write session state: {error}"))
}

#[tauri::command]
fn codex_list_models(
  app: AppHandle,
  state: State<'_, AppState>
) -> Result<Vec<CodexModelOption>, String> {
  let mut service = state
    .codex
    .lock()
    .map_err(|_| "session state was poisoned".to_string())?;
  let sessions = service.sessions.clone();
  if service.client.is_none() {
    service.client = Some(CodexAppServer::spawn(&app, sessions)?);
  }
  let client = service
    .client
    .as_ref()
    .ok_or_else(|| "failed to initialize codex app-server".to_string())?;

  let response = client.send_request(
    "model/list",
    json!({
      "limit": 50,
      "includeHidden": false
    })
  )?;

  let models = response
    .get("data")
    .and_then(Value::as_array)
    .cloned()
    .unwrap_or_default()
    .into_iter()
    .filter_map(|entry| {
      let id = entry
        .get("id")
        .or_else(|| entry.get("model"))
        .and_then(Value::as_str)?
        .to_string();
      let display_name = entry
        .get("displayName")
        .and_then(Value::as_str)
        .unwrap_or(&id)
        .to_string();
      let input_modalities = entry
        .get("inputModalities")
        .and_then(Value::as_array)
        .map(|modalities| {
          modalities
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect::<Vec<_>>()
        })
        .filter(|modalities| !modalities.is_empty())
        .unwrap_or_else(|| vec!["text".to_string(), "image".to_string()]);
      let is_default = entry
        .get("isDefault")
        .and_then(Value::as_bool)
        .unwrap_or(false);

      Some(CodexModelOption {
        id,
        display_name,
        input_modalities,
        is_default
      })
    })
    .collect::<Vec<_>>();

  Ok(models)
}

#[tauri::command]
fn codex_start_session(
  app: AppHandle,
  state: State<'_, AppState>,
  input: CodexStartSessionInput
) -> Result<CodexStartSessionOutput, String> {
  let mut service = state
    .codex
    .lock()
    .map_err(|_| "session state was poisoned".to_string())?;
  let sessions = service.sessions.clone();
  if service.client.is_none() {
    service.client = Some(CodexAppServer::spawn(&app, sessions.clone())?);
  }
  let client = service
    .client
    .as_ref()
    .ok_or_else(|| "failed to initialize codex app-server".to_string())?;

  let thread_result = client.send_request(
    "thread/start",
    json!({
      "model": input.model,
      "cwd": input.workspace_path,
      "approvalPolicy": "never",
      "sandbox": "workspace-write",
      "experimentalRawEvents": false,
      "persistExtendedHistory": false
    })
  )?;

  let thread_id = thread_result
    .get("thread")
    .and_then(|thread| thread.get("id"))
    .and_then(Value::as_str)
    .ok_or_else(|| "codex app-server returned no thread id".to_string())?
    .to_string();

  sessions
    .lock()
    .map_err(|_| "session state was poisoned".to_string())?
    .insert(
      thread_id.clone(),
      SessionRuntime {
        thread_id: thread_id.clone(),
        current_turn_id: None,
        pending_user_input: None
      }
    );

  emit_started(&app, &input, &thread_id);

  if let Err(error) = client.send_request(
    "turn/start",
    json!({
      "threadId": thread_id,
      "input": build_turn_input(&input.prompt, &input.attachments)?
    })
  ) {
    emit_failed(&app, &thread_id, &error);
  }

  Ok(CodexStartSessionOutput { session_id: thread_id })
}

#[tauri::command]
fn codex_send_input(
  app: AppHandle,
  state: State<'_, AppState>,
  input: CodexSessionInput
) -> Result<(), String> {
  let mut service = state
    .codex
    .lock()
    .map_err(|_| "session state was poisoned".to_string())?;
  let sessions = service.sessions.clone();
  if service.client.is_none() {
    service.client = Some(CodexAppServer::spawn(&app, sessions.clone())?);
  }
  let client = service
    .client
    .as_ref()
    .ok_or_else(|| "failed to initialize codex app-server".to_string())?;
  let mut sessions = sessions
    .lock()
    .map_err(|_| "session state was poisoned".to_string())?;
  let runtime = ensure_session_runtime(
    client,
    &mut sessions,
    &input.session_id,
    &input.workspace_path,
    &input.model
  )?;

  let answer_text = input.input.clone();
  emit_input_received(&app, &runtime.thread_id, &input.input, input.attachments.len());

  if let Some(pending) = runtime.pending_user_input.take() {
    let answers = pending
      .question_ids
      .iter()
      .map(|question_id| {
        (
          question_id.clone(),
          json!({
            "answers": [answer_text]
          })
        )
      })
      .collect::<serde_json::Map<String, Value>>();

    if let Err(error) = client.send_response(pending.request_id, json!({ "answers": answers })) {
      emit_failed(&app, &runtime.thread_id, &error);
    }
    return Ok(());
  }

  if let Err(error) = client.send_request(
    "turn/start",
    json!({
      "threadId": runtime.thread_id,
      "input": build_turn_input(&input.input, &input.attachments)?
    })
  ) {
    emit_failed(&app, &runtime.thread_id, &error);
  }

  Ok(())
}

#[tauri::command]
fn codex_set_session_model(
  app: AppHandle,
  state: State<'_, AppState>,
  input: CodexSessionModelInput
) -> Result<(), String> {
  let mut service = state
    .codex
    .lock()
    .map_err(|_| "session state was poisoned".to_string())?;
  let sessions = service.sessions.clone();
  if service.client.is_none() {
    service.client = Some(CodexAppServer::spawn(&app, sessions.clone())?);
  }
  let client = service
    .client
    .as_ref()
    .ok_or_else(|| "failed to initialize codex app-server".to_string())?;
  let mut sessions = sessions
    .lock()
    .map_err(|_| "session state was poisoned".to_string())?;
  let runtime = ensure_session_runtime(
    client,
    &mut sessions,
    &input.session_id,
    &input.workspace_path,
    &input.model
  )?;

  client.send_request(
    "thread/resume",
    json!({
      "threadId": runtime.thread_id,
      "cwd": input.workspace_path,
      "model": input.model
    })
  )?;

  Ok(())
}

#[tauri::command]
fn codex_interrupt_session(
  app: AppHandle,
  state: State<'_, AppState>,
  input: CodexSessionRef
) -> Result<(), String> {
  let mut service = state
    .codex
    .lock()
    .map_err(|_| "session state was poisoned".to_string())?;
  let sessions = service.sessions.clone();
  if service.client.is_none() {
    service.client = Some(CodexAppServer::spawn(&app, sessions.clone())?);
  }
  let client = service
    .client
    .as_ref()
    .ok_or_else(|| "failed to initialize codex app-server".to_string())?;
  let mut sessions = sessions
    .lock()
    .map_err(|_| "session state was poisoned".to_string())?;
  let Some(runtime) = sessions.get_mut(&input.session_id) else {
    return Ok(());
  };

  let Some(turn_id) = runtime.current_turn_id.clone() else {
    return Ok(());
  };

  if let Err(error) = client.send_request(
    "turn/interrupt",
    json!({
      "threadId": runtime.thread_id,
      "turnId": turn_id
    })
  ) {
    emit_failed(&app, &runtime.thread_id, &error);
    return Ok(());
  }

  runtime.current_turn_id = None;
  emit_waiting_for_input(
    &app,
    &runtime.thread_id,
    "Execution interrupted. Provide more input to continue."
  );
  Ok(())
}

#[tauri::command]
fn codex_dispose_session(
  state: State<'_, AppState>,
  input: CodexSessionRef
) -> Result<(), String> {
  let mut service = state
    .codex
    .lock()
    .map_err(|_| "session state was poisoned".to_string())?;
  service
    .sessions
    .lock()
    .map_err(|_| "session state was poisoned".to_string())?
    .remove(&input.session_id);

  if let Some(client) = service.client.as_mut() {
    let _ = client.send_request(
      "thread/unsubscribe",
      json!({
        "threadId": input.session_id
      })
    );
  }

  Ok(())
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
  let open_item = MenuItemBuilder::with_id(MENU_OPEN, "Open Session Kid").build(app)?;
  let quit_item = MenuItemBuilder::with_id(MENU_QUIT, "Quit Session Kid").build(app)?;

  let menu = MenuBuilder::new(app)
    .item(&open_item)
    .separator()
    .item(&quit_item)
    .build()?;

  TrayIconBuilder::with_id(TRAY_ID)
    .menu(&menu)
    .show_menu_on_left_click(false)
    .title("SK")
    .tooltip("Session Kid: idle")
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        let _ = show_main_window(&tray.app_handle());
      }
    })
    .on_menu_event(|app, event| match event.id.as_ref() {
      MENU_OPEN => {
        let _ = show_main_window(app);
      }
      MENU_QUIT => {
        app.exit(0);
      }
      _ => {}
    })
    .build(app)?;

  Ok(())
}

pub fn run() {
  tauri::Builder::default()
    .manage(AppState::default())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_notification::init())
    .setup(|app| {
      build_tray(&app.handle())?;
      apply_tray_state(&app.handle(), TrayState::Idle)?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      set_tray_state,
      reveal_main_window,
      load_session_state,
      save_session_state,
      codex_list_models,
      codex_start_session,
      codex_set_session_model,
      codex_send_input,
      codex_interrupt_session,
      codex_dispose_session
    ])
    .run(tauri::generate_context!())
    .expect("error while running Session Kid");
}
