use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::ProjectPath;

fn backups_dir(project: &str) -> PathBuf {
    PathBuf::from(project)
        .join(".devmanager")
        .join("backups")
}

fn state_file(project: &str) -> PathBuf {
    PathBuf::from(project).join(".devmanager").join("state.json")
}

#[derive(serde::Serialize)]
pub struct BackupInfo {
    pub name: String,
    #[serde(rename = "lastModified")]
    pub last_modified: f64,
}

#[tauri::command]
pub fn list_backups(project: State<'_, ProjectPath>) -> Result<Vec<BackupInfo>, String> {
    let dir = backups_dir(&project.get());
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        if name.starts_with("state-") && name.ends_with(".json") {
            let mtime = fs::metadata(&path)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as f64)
                .unwrap_or(0.0);
            backups.push(BackupInfo {
                name,
                last_modified: mtime,
            });
        }
    }

    backups.sort_by(|a, b| b.last_modified.partial_cmp(&a.last_modified).unwrap());
    Ok(backups)
}

#[tauri::command]
pub fn create_snapshot(project: State<'_, ProjectPath>) -> Result<String, String> {
    let state_path = state_file(&project.get());
    if !state_path.exists() {
        return Err("no_state".to_string());
    }

    let dir = backups_dir(&project.get());
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let filename = format!("state-{}.json", timestamp);
    let dest = dir.join(&filename);

    fs::copy(&state_path, &dest).map_err(|e| e.to_string())?;

    // Auto-prune: keep only 10 most recent
    let mut backups: Vec<_> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter(|e| {
            e.path()
                .file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("state-") && n.ends_with(".json"))
                .unwrap_or(false)
        })
        .collect();

    backups.sort_by_key(|e| {
        e.metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .unwrap_or(std::time::UNIX_EPOCH)
    });
    backups.reverse();

    for old in backups.iter().skip(10) {
        let _ = fs::remove_file(old.path());
    }

    Ok(filename)
}

#[tauri::command]
pub fn restore_backup(filename: String, project: State<'_, ProjectPath>) -> Result<bool, String> {
    if !filename.starts_with("state-") || !filename.ends_with(".json") {
        return Err("Invalid backup filename".to_string());
    }

    let backup_path = backups_dir(&project.get()).join(&filename);
    if !backup_path.exists() {
        return Err("Backup not found".to_string());
    }

    // Validate it's valid JSON
    let content = fs::read_to_string(&backup_path).map_err(|e| e.to_string())?;
    let _: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let state_path = state_file(&project.get());
    fs::copy(&backup_path, &state_path).map_err(|e| e.to_string())?;

    Ok(true)
}
