use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

use crate::ProjectPath;

/// Stores the list of known projects (persists in memory for the session).
pub struct ProjectList(pub Mutex<Vec<String>>);

impl ProjectList {
    pub fn new() -> Self {
        Self(Mutex::new(Vec::new()))
    }
}

#[derive(serde::Serialize)]
pub struct ProjectInfo {
    pub path: String,
    pub name: String,
    pub active: bool,
}

#[tauri::command]
pub fn list_projects(
    project: State<'_, ProjectPath>,
    list: State<'_, ProjectList>,
) -> Result<Vec<ProjectInfo>, String> {
    let active = project.get();
    let paths = list.0.lock().map_err(|e| e.to_string())?;
    Ok(paths
        .iter()
        .map(|p| {
            let name = PathBuf::from(p)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();
            ProjectInfo {
                path: p.clone(),
                name,
                active: *p == active,
            }
        })
        .collect())
}

#[tauri::command]
pub fn add_project(path: String, list: State<'_, ProjectList>) -> Result<bool, String> {
    let mut paths = list.0.lock().map_err(|e| e.to_string())?;
    if !paths.contains(&path) {
        paths.push(path);
    }
    Ok(true)
}

#[tauri::command]
pub fn browse_directories(path: Option<String>) -> Result<serde_json::Value, String> {
    let dir = path
        .map(PathBuf::from)
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")));

    if !dir.exists() || !dir.is_dir() {
        return Err("Directory does not exist".to_string());
    }

    let parent = dir.parent().map(|p| p.to_string_lossy().to_string());

    let mut dirs = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_dir() {
                let name = entry
                    .file_name()
                    .to_string_lossy()
                    .to_string();
                // Skip hidden dirs
                if name.starts_with('.') {
                    continue;
                }
                let is_project = entry_path.join(".devmanager").exists()
                    || entry_path.join(".git").exists();
                dirs.push(serde_json::json!({
                    "name": name,
                    "path": entry_path.to_string_lossy(),
                    "isProject": is_project,
                }));
            }
        }
    }

    // Sort alphabetically
    dirs.sort_by(|a, b| {
        a.get("name")
            .and_then(|n| n.as_str())
            .unwrap_or("")
            .to_lowercase()
            .cmp(
                &b.get("name")
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_lowercase(),
            )
    });

    Ok(serde_json::json!({
        "current": dir.to_string_lossy(),
        "parent": parent,
        "dirs": dirs,
    }))
}
