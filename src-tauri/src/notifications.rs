use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
pub struct LearningNotifications {
    session: Mutex<(String, u64)>,
}
static APP: OnceLock<AppHandle> = OnceLock::new();
static ACTIONS: OnceLock<Mutex<Vec<Value>>> = OnceLock::new();

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NotificationJob {
    pub id: String,
    pub due_at: u64,
    pub conversation_id: String,
    pub reminder_id: String,
    pub generation: String,
    pub kind: String,
    pub day: String,
    pub question_key: Option<String>,
}
fn identifier(value: &str, maximum: usize) -> bool {
    !value.is_empty() && value.len() <= maximum && value.bytes().all(|b| b.is_ascii_alphanumeric() || b"_-:@.".contains(&b))
}
fn validate_jobs(jobs: &[NotificationJob], now: u64) -> Result<(), String> {
    let mut ids = std::collections::HashSet::new();
    if jobs.len() > 64 { return Err("系统提醒最多64项，请缩短安排范围".into()); }
    for job in jobs {
        if !identifier(&job.id, 160) || !identifier(&job.conversation_id, 160)
            || !identifier(&job.reminder_id, 160) || !identifier(&job.generation, 160)
            || job.question_key.as_ref().is_some_and(|k| !identifier(k, 180))
            || !["study", "review", "recap"].contains(&job.kind.as_str())
            || job.day.len() != 10 || !job.day.bytes().all(|b| b.is_ascii_digit() || b == b'-')
            || job.due_at <= now || job.due_at - now > 8 * 86400000 || !ids.insert(&job.id)
        { return Err("提醒时间或任务标识不合法，请重新核对".into()); }
    }
    Ok(())
}
fn checked_reply(result: Value) -> Result<Value, String> {
    if result.get("ok").and_then(Value::as_bool) == Some(true) { return Ok(result); }
    let message = match result.get("failure").and_then(Value::as_str) {
        Some("permission-timeout") => "系统通知授权尚未确认，请在系统设置中核对后重试".to_string(),
        Some("permission-error") => {
            let domain = result.get("errorDomain").and_then(Value::as_str)
                .filter(|d| ["UNErrorDomain", "NSCocoaErrorDomain", "NSPOSIXErrorDomain"].contains(d)).unwrap_or("system");
            let code = result.get("errorCode").and_then(Value::as_i64).filter(|c| (-99999..=99999).contains(c)).unwrap_or(0);
            format!("系统通知授权失败（{domain}:{code}），请在系统设置中核对后重试")
        }
        _ => "系统通知未确认，请检查通知权限后重试".to_string(),
    };
    Err(message)
}
#[cfg(target_os = "macos")]
extern "C" {
    fn yozi_notifications_call(request: *const std::ffi::c_char) -> *mut std::ffi::c_char;
    fn yozi_notifications_free(reply: *mut std::ffi::c_char);
}
#[cfg(target_os = "macos")]
fn native_call(request: Value) -> Result<Value, String> {
    use std::ffi::{CStr, CString};
    let request = CString::new(request.to_string()).map_err(|_| "提醒请求不合法")?;
    let reply = unsafe { yozi_notifications_call(request.as_ptr()) };
    if reply.is_null() { return Err("系统通知暂不可用".into()); }
    let text = unsafe { CStr::from_ptr(reply) }.to_string_lossy().into_owned();
    unsafe { yozi_notifications_free(reply) };
    if text.len() > 65536 { return Err("通知回执超过上限".into()); }
    let result: Value = serde_json::from_str(&text).map_err(|_| "通知回执不合法")?;
    checked_reply(result)
}
#[cfg(not(target_os = "macos"))]
fn native_call(_request: Value) -> Result<Value, String> { Err("此终端尚未接入后台定时通知".into()) }

pub fn bootstrap() {
    ACTIONS.get_or_init(|| Mutex::new(Vec::new()));
    #[cfg(target_os = "macos")]
    { let _ = native_call(json!({ "action": "bootstrap" })); }
}
pub fn initialize(app: AppHandle) {
    let _ = APP.set(app);
}

#[no_mangle]
pub extern "C" fn yozi_notification_action(payload: *const std::ffi::c_char) {
    if payload.is_null() { return; }
    let text = unsafe { std::ffi::CStr::from_ptr(payload) }.to_string_lossy();
    if text.len() > 4096 { return; }
    if let Ok(value) = serde_json::from_str::<Value>(&text) {
        if let Some(queue) = ACTIONS.get() {
            if let Ok(mut actions) = queue.lock() { if actions.len() < 20 { actions.push(value.clone()); } }
        }
        if let Some(app) = APP.get() {
            let _ = app.emit("learning-notification-action", value);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize(); let _ = window.show(); let _ = window.set_focus();
            }
        }
    }
}

#[tauri::command]
pub fn begin_learning_notifications(state: State<'_, LearningNotifications>) -> Result<String, String> {
    let token = uuid::Uuid::new_v4().to_string();
    *state.session.lock().map_err(|_| "通知状态不可用")? = (token.clone(), 0);
    Ok(token)
}
#[tauri::command]
pub async fn learning_notification_permission(request: bool, consent: bool) -> Result<Value, String> {
    if request && !consent { return Err("请先明确允许系统提醒".into()); }
    tauri::async_runtime::spawn_blocking(move || native_call(json!({ "action": "permission", "request": request })))
        .await.map_err(|_| "系统通知读取失败")?
}
#[tauri::command]
pub async fn replace_learning_notifications(
    state: State<'_, LearningNotifications>, token: String, sequence: u64,
    jobs: Vec<NotificationJob>, consent: bool,
) -> Result<Value, String> {
    if !jobs.is_empty() && !consent { return Err("请先明确允许系统提醒".into()); }
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|_| "系统时间不合法")?.as_millis() as u64;
    validate_jobs(&jobs, now)?;
    // 锁覆盖原生应用；后来的取消/账户换代随后清除，不允许旧请求越过新序号。
    let mut current = state.session.lock().map_err(|_| "通知状态不可用")?;
    if token != current.0 || sequence <= current.1 { return Err("通知请求已失效".into()); }
    current.1 = sequence;
    native_call(json!({ "action": "replace", "jobs": jobs }))
}
#[tauri::command]
pub fn take_learning_notification_actions(_state: State<'_, LearningNotifications>) -> Vec<Value> {
    ACTIONS.get().and_then(|queue| queue.lock().ok()).map(|mut actions| std::mem::take(&mut *actions)).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn job(now: u64) -> NotificationJob {
        NotificationJob { id: "reminder:1:2026-10-10".into(), due_at: now + 10000,
            conversation_id: "conversation-1".into(), reminder_id: "reminder".into(), generation: "generation".into(),
            kind: "study".into(), day: "2026-10-10".into(), question_key: None }
    }
    #[test]
    fn schedule_rejects_unknown_routes_duplicate_ids_expired_or_unbounded_dates() {
        let now = 1791626400000;
        assert!(validate_jobs(&[job(now)], now).is_ok());
        let mut invalid = job(now); invalid.conversation_id = "https://untrusted.example/path".into();
        assert!(validate_jobs(&[invalid], now).is_err());
        assert!(validate_jobs(&[job(now), job(now)], now).is_err());
        let mut expired = job(now); expired.due_at = now;
        assert!(validate_jobs(&[expired], now).is_err());
        let mut future = job(now); future.due_at = now + 9 * 86400000;
        assert!(validate_jobs(&[future], now).is_err());
    }
    #[test]
    fn permission_receipts_distinguish_denial_timeout_and_bounded_system_errors() {
        assert_eq!(checked_reply(json!({"ok": true, "permission": "denied"})).unwrap()["permission"], "denied");
        assert!(checked_reply(json!({"ok": false, "failure": "permission-timeout"})).unwrap_err().contains("尚未确认"));
        assert!(checked_reply(json!({"ok": false, "failure": "permission-error", "errorDomain": "UNErrorDomain", "errorCode": 1})).unwrap_err().contains("UNErrorDomain:1"));
        let error = checked_reply(json!({"ok": false, "failure": "permission-error", "errorDomain": "private payload", "errorCode": 1000000, "message": "secret"})).unwrap_err();
        assert!(error.contains("system:0"));
        assert!(!error.contains("private") && !error.contains("secret"));
    }
}
