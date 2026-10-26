use serde_json::{json, Value};
use std::sync::{Mutex, OnceLock};
use tauri::{ipc::Channel, WebviewWindow};

type VoiceChannel = Option<(String, Channel<Value>)>;
static CHANNEL: OnceLock<Mutex<VoiceChannel>> = OnceLock::new();
fn channel() -> &'static Mutex<VoiceChannel> {
    CHANNEL.get_or_init(|| Mutex::new(None))
}
fn enabled(window: &WebviewWindow) -> bool {
    cfg!(target_os = "macos")
        && window.label() == "main"
        && matches!(option_env!("YOZI_BUILD_CHANNEL"), Some("dev" | "test"))
}
fn checked_locale(locale: &str) -> Result<(), String> {
    if !["zh-CN", "en-US"].contains(&locale) {
        return Err("此听写语言尚未开放".into());
    }
    Ok(())
}

#[cfg(target_os = "macos")]
extern "C" {
    fn yozi_voice_capability(locale: *const std::ffi::c_char) -> *mut std::ffi::c_char;
    fn yozi_voice_free(reply: *mut std::ffi::c_char);
    fn yozi_voice_start(
        sid: *const std::ffi::c_char,
        locale: *const std::ffi::c_char,
        reply: extern "C" fn(*const std::ffi::c_char),
    );
    fn yozi_voice_stop(sid: *const std::ffi::c_char);
    fn yozi_voice_cancel(sid: *const std::ffi::c_char);
    fn yozi_voice_cancel_all();
}
#[cfg(target_os = "macos")]
extern "C" fn receive(reply: *const std::ffi::c_char) {
    if reply.is_null() {
        return;
    }
    let text = unsafe { std::ffi::CStr::from_ptr(reply) }.to_bytes();
    if text.len() > 131072 {
        return;
    }
    let Ok(value) = serde_json::from_slice::<Value>(text) else {
        return;
    };
    let Some(sid) = value["sid"].as_str() else {
        return;
    };
    let terminal = matches!(value["kind"].as_str(), Some("ended" | "error"));
    let target = {
        let Ok(mut guard) = channel().lock() else {
            return;
        };
        let Some((current, target)) = guard.as_ref() else {
            return;
        };
        if current != sid {
            return;
        }
        let target = target.clone();
        if terminal {
            *guard = None;
        }
        target
    };
    // No text/audio logging, persistence, backend calls or broadcast events.
    let _ = target.send(value);
}

#[tauri::command]
pub fn voice_capability(window: WebviewWindow, locale: String) -> Result<Value, String> {
    if !enabled(&window) {
        return Ok(json!({"supported":false,"available":false,"reason":"test_only"}));
    }
    checked_locale(&locale)?;
    #[cfg(target_os = "macos")]
    {
        let locale = std::ffi::CString::new(locale).map_err(|_| "听写语言不合法")?;
        let reply = unsafe { yozi_voice_capability(locale.as_ptr()) };
        if reply.is_null() {
            return Err("本机识别不可用".into());
        }
        let text = unsafe { std::ffi::CStr::from_ptr(reply) }
            .to_bytes()
            .to_vec();
        unsafe { yozi_voice_free(reply) };
        return serde_json::from_slice(&text).map_err(|_| "本机能力回执无效".into());
    }
    #[cfg(not(target_os = "macos"))]
    Ok(json!({"supported":false,"available":false,"reason":"platform_unsupported"}))
}
#[tauri::command]
pub fn voice_start(
    window: WebviewWindow,
    locale: String,
    on_event: Channel<Value>,
) -> Result<String, String> {
    if !enabled(&window) {
        return Err("此构建未开放本机听写".into());
    }
    checked_locale(&locale)?;
    if locale != "zh-CN" {
        return Err("首批听写仅支持普通话，英文尚未验收".into());
    }
    let sid = uuid::Uuid::new_v4().to_string();
    #[cfg(target_os = "macos")]
    {
        let native_sid = std::ffi::CString::new(sid.as_str()).map_err(|_| "听写标识不合法")?;
        let locale = std::ffi::CString::new(locale).map_err(|_| "听写语言不合法")?;
        let mut guard = channel().lock().map_err(|_| "本机听写暂不可用")?;
        *guard = Some((sid.clone(), on_event));
        unsafe {
            yozi_voice_start(native_sid.as_ptr(), locale.as_ptr(), receive);
        }
    }
    #[cfg(not(target_os = "macos"))]
    let _ = on_event;
    Ok(sid)
}
fn finish(window: &WebviewWindow, sid: &str, cancel: bool) -> Result<(), String> {
    if !enabled(window) {
        return Err("此构建未开放本机听写".into());
    }
    let mut guard = channel().lock().map_err(|_| "本机听写暂不可用")?;
    if guard.as_ref().is_none_or(|(current, _)| current != sid) {
        return Ok(());
    }
    if cancel {
        *guard = None;
    }
    #[cfg(target_os = "macos")]
    {
        let sid = std::ffi::CString::new(sid).map_err(|_| "听写标识不合法")?;
        unsafe {
            if cancel {
                yozi_voice_cancel(sid.as_ptr());
            } else {
                yozi_voice_stop(sid.as_ptr());
            }
        }
    }
    Ok(())
}
#[tauri::command]
pub fn voice_stop(window: WebviewWindow, sid: String) -> Result<(), String> {
    finish(&window, &sid, false)
}
#[tauri::command]
pub fn voice_cancel(window: WebviewWindow, sid: String) -> Result<(), String> {
    finish(&window, &sid, true)
}
pub fn cancel_all() {
    if let Ok(mut guard) = channel().lock() {
        *guard = None;
    }
    #[cfg(target_os = "macos")]
    unsafe {
        yozi_voice_cancel_all();
    }
}
