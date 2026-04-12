use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::ProjectPath;

fn state_file(project: &str) -> PathBuf {
    PathBuf::from(project).join(".devmanager").join("state.json")
}

fn now_iso() -> String {
    let d = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    let secs = d.as_secs();
    // Simple ISO-8601 without pulling in chrono
    let (s, m, h) = (secs % 60, (secs / 60) % 60, (secs / 3600) % 24);
    let days = secs / 86400;
    // Approximate date calculation (good enough for savedAt)
    let (y, mo, day) = civil_from_days(days as i64);
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", y, mo, day, h, m, s)
}

fn civil_from_days(days: i64) -> (i64, u32, u32) {
    // Algorithm from Howard Hinnant
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

#[derive(serde::Serialize)]
pub struct StateResult {
    pub data: Value,
    #[serde(rename = "lastModified")]
    pub last_modified: f64,
}

#[derive(serde::Serialize)]
pub struct WriteResult {
    pub ok: bool,
    #[serde(rename = "lastModified")]
    pub last_modified: f64,
}

#[derive(serde::Serialize)]
pub struct ConflictResult {
    pub error: String,
    pub data: Value,
    #[serde(rename = "lastModified")]
    pub last_modified: f64,
}

#[tauri::command]
pub fn read_state(project: State<'_, ProjectPath>) -> Result<StateResult, String> {
    let path = state_file(&project.get());
    if !path.exists() {
        return Err("no_state".to_string());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    let mtime = meta
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as f64;

    Ok(StateResult {
        data,
        last_modified: mtime,
    })
}

#[tauri::command]
pub fn write_state(
    data: Value,
    last_modified: f64,
    project: State<'_, ProjectPath>,
) -> Result<WriteResult, String> {
    let path = state_file(&project.get());

    // Optimistic locking: check current mtime
    if path.exists() {
        let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
        let current_mtime = meta
            .modified()
            .map_err(|e| e.to_string())?
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis() as f64;

        if current_mtime > last_modified {
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let current_data: Value =
                serde_json::from_str(&content).map_err(|e| e.to_string())?;
            return Err(serde_json::to_string(&ConflictResult {
                error: "Conflict: file on disk is newer".to_string(),
                data: current_data,
                last_modified: current_mtime,
            })
            .unwrap());
        }
    }

    // Ensure .devmanager/ directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Write with version increment
    let mut state = data;
    if let Some(obj) = state.as_object_mut() {
        let v = obj.get("_v").and_then(|v| v.as_i64()).unwrap_or(0);
        obj.insert("_v".to_string(), serde_json::json!(v + 1));
        obj.insert("savedAt".to_string(), serde_json::json!(now_iso()));
    }

    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(&path, &json).map_err(|e| e.to_string())?;

    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    let new_mtime = meta
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as f64;

    Ok(WriteResult {
        ok: true,
        last_modified: new_mtime,
    })
}
