// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use commands::launch::ProcessStore;
use std::sync::Mutex;
use tauri::Manager;

/// Holds the active project path — equivalent to getActiveProject() in the Node.js server.
pub struct ProjectPath(pub Mutex<String>);

impl ProjectPath {
    pub fn get(&self) -> String {
        self.0.lock().unwrap().clone()
    }

    pub fn set(&self, path: String) {
        *self.0.lock().unwrap() = path;
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ProjectPath(Mutex::new(String::new())))
        .manage(ProcessStore::new())
        .invoke_handler(tauri::generate_handler![
            set_project_path,
            get_project_info,
            // State
            commands::state::read_state,
            commands::state::write_state,
            // Progress
            commands::progress::read_progress,
            commands::progress::delete_progress,
            // Watcher
            commands::watcher::watch_project,
            // Skills
            commands::skills::discover_skills,
            commands::skills::deploy_skill,
            commands::skills::deploy_agent,
            commands::skills::read_skills_config,
            commands::skills::write_skills_config,
            // Git
            commands::git::git_status,
            commands::git::git_push,
            // Launch
            commands::launch::launch_process,
            commands::launch::list_processes,
            commands::launch::kill_process,
            // Backups
            commands::backup::list_backups,
            commands::backup::create_snapshot,
            commands::backup::restore_backup,
            // Generic
            read_json_file,
        ])
        .setup(|app| {
            // Default project path: current working directory
            let cwd = std::env::current_dir()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            // Or take from CLI args
            let project_path = std::env::args().nth(1).unwrap_or(cwd);

            let state = app.state::<ProjectPath>();
            state.set(project_path);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Set the active project path (called from frontend during project switch)
#[tauri::command]
fn set_project_path(path: String, project: tauri::State<'_, ProjectPath>) -> Result<bool, String> {
    project.set(path);
    Ok(true)
}

/// Read any JSON file from .devmanager/{relPath}
#[tauri::command]
fn read_json_file(rel_path: String, project: tauri::State<'_, ProjectPath>) -> Result<serde_json::Value, String> {
    let path = std::path::PathBuf::from(project.get())
        .join(".devmanager")
        .join(&rel_path);
    if !path.exists() {
        return Err("not_found".to_string());
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

/// Get current project info
#[tauri::command]
fn get_project_info(project: tauri::State<'_, ProjectPath>) -> Result<serde_json::Value, String> {
    let path = project.get();
    let name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    Ok(serde_json::json!({
        "projectPath": path,
        "projectName": name
    }))
}
