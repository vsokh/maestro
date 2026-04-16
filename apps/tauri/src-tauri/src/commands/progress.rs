use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::ProjectPath;

fn progress_dir(project: &str) -> PathBuf {
    PathBuf::from(project).join(".maestro").join("progress")
}

#[tauri::command]
pub fn read_progress(project: State<'_, ProjectPath>) -> Result<Value, String> {
    let dir = progress_dir(&project.get());
    if !dir.exists() {
        return Ok(serde_json::json!({}));
    }

    let mut result = serde_json::Map::new();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let task_id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(data) = serde_json::from_str::<Value>(&content) {
                result.insert(task_id, data);
            }
        }
    }

    Ok(Value::Object(result))
}

#[tauri::command]
pub fn delete_progress(task_id: String, project: State<'_, ProjectPath>) -> Result<bool, String> {
    let path = progress_dir(&project.get()).join(format!("{}.json", task_id));
    if !path.exists() {
        return Err("not_found".to_string());
    }
    fs::remove_file(&path).map_err(|e| e.to_string())?;
    Ok(true)
}
