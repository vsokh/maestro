use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

use crate::ProjectPath;

/// Start watching .devmanager/ for state, progress, quality, and errors changes.
/// Emits Tauri events that the frontend listens to (same role as WebSocket in the browser app).
#[tauri::command]
pub fn watch_project(app: AppHandle, project: State<'_, ProjectPath>) -> Result<(), String> {
    let project_path = project.get();
    let devmanager_dir = PathBuf::from(&project_path).join(".devmanager");

    // Ensure the directory exists
    fs::create_dir_all(&devmanager_dir).map_err(|e| e.to_string())?;

    let (tx, rx) = mpsc::channel::<notify::Result<Event>>();
    let mut watcher =
        RecommendedWatcher::new(tx, Config::default().with_poll_interval(Duration::from_secs(1)))
            .map_err(|e| e.to_string())?;

    // Watch the .devmanager directory recursively
    watcher
        .watch(&devmanager_dir, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    let project_for_thread = project_path.clone();

    // Spawn a thread to process file events
    std::thread::spawn(move || {
        let _watcher = watcher; // Keep watcher alive
        let mut last_state_emit = Instant::now() - Duration::from_secs(10);
        let mut last_progress_emit = Instant::now() - Duration::from_secs(10);
        let debounce = Duration::from_millis(200);

        loop {
            match rx.recv_timeout(Duration::from_secs(1)) {
                Ok(Ok(event)) => {
                    for path in &event.paths {
                        let rel = path
                            .strip_prefix(
                                PathBuf::from(&project_for_thread).join(".devmanager"),
                            )
                            .ok();

                        if let Some(rel_path) = rel {
                            let rel_str = rel_path.to_string_lossy();

                            // state.json changed
                            if rel_str == "state.json" && last_state_emit.elapsed() > debounce {
                                last_state_emit = Instant::now();
                                if let Ok(content) = fs::read_to_string(path) {
                                    if let Ok(data) = serde_json::from_str::<Value>(&content) {
                                        let mtime = fs::metadata(path)
                                            .ok()
                                            .and_then(|m| m.modified().ok())
                                            .and_then(|t| {
                                                t.duration_since(std::time::UNIX_EPOCH).ok()
                                            })
                                            .map(|d| d.as_millis() as f64)
                                            .unwrap_or(0.0);
                                        let _ = app_handle.emit(
                                            "dm:state",
                                            serde_json::json!({
                                                "type": "state",
                                                "data": data,
                                                "lastModified": mtime
                                            }),
                                        );
                                    }
                                }
                            }

                            // progress/*.json changed
                            if rel_str.starts_with("progress")
                                && rel_str.ends_with(".json")
                                && last_progress_emit.elapsed() > debounce
                            {
                                last_progress_emit = Instant::now();
                                // Read all progress files and emit
                                let progress_dir = PathBuf::from(&project_for_thread)
                                    .join(".devmanager")
                                    .join("progress");
                                if let Ok(entries) = fs::read_dir(&progress_dir) {
                                    let mut result = serde_json::Map::new();
                                    for entry in entries.flatten() {
                                        let p = entry.path();
                                        if p.extension().and_then(|e| e.to_str()) == Some("json")
                                        {
                                            let task_id = p
                                                .file_stem()
                                                .and_then(|s| s.to_str())
                                                .unwrap_or("")
                                                .to_string();
                                            if let Ok(c) = fs::read_to_string(&p) {
                                                if let Ok(d) =
                                                    serde_json::from_str::<Value>(&c)
                                                {
                                                    result.insert(task_id, d);
                                                }
                                            }
                                        }
                                    }
                                    let _ = app_handle.emit(
                                        "dm:progress",
                                        serde_json::json!({
                                            "type": "progress",
                                            "data": Value::Object(result)
                                        }),
                                    );
                                }
                            }

                            // quality/latest.json changed
                            if rel_str == "quality/latest.json"
                                || rel_str == "quality\\latest.json"
                            {
                                if let Ok(content) = fs::read_to_string(path) {
                                    if let Ok(data) = serde_json::from_str::<Value>(&content) {
                                        let _ = app_handle.emit(
                                            "dm:quality",
                                            serde_json::json!({
                                                "type": "quality",
                                                "data": data
                                            }),
                                        );
                                    }
                                }
                            }

                            // errors/*.json changed
                            if (rel_str.starts_with("errors") || rel_str.starts_with("errors\\"))
                                && rel_str.ends_with(".json")
                            {
                                if let Ok(content) = fs::read_to_string(path) {
                                    if let Ok(data) = serde_json::from_str::<Value>(&content) {
                                        let _ = app_handle.emit(
                                            "dm:errors",
                                            serde_json::json!({
                                                "type": "errors",
                                                "data": data
                                            }),
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
                Ok(Err(e)) => {
                    eprintln!("[watcher] Error: {:?}", e);
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    // Just keep waiting
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    break;
                }
            }
        }
    });

    Ok(())
}
