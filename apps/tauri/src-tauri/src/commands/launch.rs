use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::ProjectPath;

pub struct ProcessStore {
    pub processes: Arc<Mutex<HashMap<u32, ProcessEntry>>>,
}

pub struct ProcessEntry {
    pub pid: u32,
    pub task_id: i64,
    pub command: String,
    pub start_time: f64,
}

impl ProcessStore {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[derive(serde::Serialize)]
pub struct LaunchResult {
    pub pid: u32,
    #[serde(rename = "taskId")]
    pub task_id: i64,
    pub command: String,
}

#[derive(serde::Serialize)]
pub struct ProcessInfo {
    pub pid: u32,
    #[serde(rename = "taskId")]
    pub task_id: i64,
    pub command: String,
    #[serde(rename = "startTime")]
    pub start_time: f64,
}

#[tauri::command]
pub async fn launch_process(
    task_id: i64,
    command: String,
    engine: Option<String>,
    app: AppHandle,
    project: State<'_, ProjectPath>,
    store: State<'_, ProcessStore>,
) -> Result<LaunchResult, String> {
    let engine_name = engine.unwrap_or_else(|| "claude".to_string());
    let cwd = project.get();

    let (program, args) = match engine_name.as_str() {
        "claude" => ("claude".to_string(), vec!["-p".to_string(), command.clone()]),
        "codex" => ("codex".to_string(), vec![command.clone()]),
        _ => return Err(format!("Unknown engine: {}", engine_name)),
    };

    let mut child = Command::new(&program)
        .args(&args)
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", program, e))?;

    let pid = child.id().unwrap_or(0);

    // Store the process
    {
        let mut procs = store.processes.lock().unwrap();
        procs.insert(
            pid,
            ProcessEntry {
                pid,
                task_id,
                command: command.clone(),
                start_time: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as f64,
            },
        );
    }

    // Stream stdout
    if let Some(stdout) = child.stdout.take() {
        let app_handle = app.clone();
        let tid = task_id;
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_handle.emit(
                    "dm:output",
                    serde_json::json!({
                        "type": "output",
                        "taskId": tid,
                        "text": line,
                        "stream": "stdout",
                        "pid": pid
                    }),
                );
            }
        });
    }

    // Stream stderr
    if let Some(stderr) = child.stderr.take() {
        let app_handle = app.clone();
        let tid = task_id;
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_handle.emit(
                    "dm:output",
                    serde_json::json!({
                        "type": "output",
                        "taskId": tid,
                        "text": line,
                        "stream": "stderr",
                        "pid": pid
                    }),
                );
            }
        });
    }

    // Wait for exit in background
    let app_exit = app.clone();
    let processes = Arc::clone(&store.processes);
    tokio::spawn(async move {
        let status = child.wait().await;
        let code = status.ok().and_then(|s| s.code()).unwrap_or(-1);
        let _ = app_exit.emit(
            "dm:exit",
            serde_json::json!({
                "type": "exit",
                "taskId": task_id,
                "code": code
            }),
        );

        // Remove from active processes
        if let Ok(mut procs) = processes.lock() {
            procs.remove(&pid);
        }
    });

    Ok(LaunchResult {
        pid,
        task_id,
        command,
    })
}

/// Open a new OS terminal tab/window with the given command.
/// On Windows: uses Windows Terminal (`wt`). On macOS: `open -a Terminal`. On Linux: `x-terminal-emulator`.
#[tauri::command]
pub fn launch_terminal(
    task_id: Option<i64>,
    command: String,
    engine: Option<String>,
    title: Option<String>,
    project: State<'_, ProjectPath>,
) -> Result<bool, String> {
    let cwd = project.get();
    let eng = engine.unwrap_or_else(|| "claude".to_string());
    let cli_name = match eng.as_str() {
        "claude" => "claude",
        "codex" => "codex",
        _ => "cursor-agent",
    };
    let tab_title = title.unwrap_or_else(|| format!("Task {}", task_id.unwrap_or(0)));
    let devmanager_dir = std::path::PathBuf::from(&cwd).join(".devmanager");
    std::fs::create_dir_all(&devmanager_dir).map_err(|e| e.to_string())?;

    let task_label = task_id
        .map(|id| id.to_string())
        .unwrap_or_else(|| "term".to_string());

    #[cfg(windows)]
    {
        let script_path = devmanager_dir.join(format!("launch-{}.ps1", task_label));
        // PowerShell: escape single quotes by doubling
        let safe_cmd = command.replace('\'', "''");
        std::fs::write(
            &script_path,
            format!("& {} --dangerously-skip-permissions '{}'\n", cli_name, safe_cmd),
        )
        .map_err(|e| e.to_string())?;

        std::process::Command::new("wt")
            .args([
                "-w", "0", "nt",
                "--title", &tab_title, "--suppressApplicationTitle",
                "-d", &cwd,
                "--", "pwsh", "-NoExit", "-NoLogo", "-File",
                &script_path.to_string_lossy(),
            ])
            .current_dir(&cwd)
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        let script_path = devmanager_dir.join(format!("launch-{}.sh", task_label));
        let safe_cwd = cwd.replace('"', "\\\"");
        let safe_cmd = command.replace('"', "\\\"");
        std::fs::write(
            &script_path,
            format!(
                "#!/bin/bash\ncd \"{}\" && exec {} --dangerously-skip-permissions \"{}\"\n",
                safe_cwd, cli_name, safe_cmd
            ),
        )
        .map_err(|e| e.to_string())?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&script_path, std::fs::Permissions::from_mode(0o755))
                .map_err(|e| e.to_string())?;
        }

        std::process::Command::new("open")
            .args(["-a", "Terminal", &script_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        let script_path = devmanager_dir.join(format!("launch-{}.sh", task_label));
        let safe_cwd = cwd.replace('"', "\\\"");
        let safe_cmd = command.replace('"', "\\\"");
        std::fs::write(
            &script_path,
            format!(
                "#!/bin/bash\ncd \"{}\" && {} --dangerously-skip-permissions \"{}\"; exec bash\n",
                safe_cwd, cli_name, safe_cmd
            ),
        )
        .map_err(|e| e.to_string())?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&script_path, std::fs::Permissions::from_mode(0o755))
                .map_err(|e| e.to_string())?;
        }

        std::process::Command::new("x-terminal-emulator")
            .args(["-e", &script_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    Ok(true)
}

#[tauri::command]
pub fn list_processes(store: State<'_, ProcessStore>) -> Result<Vec<ProcessInfo>, String> {
    let procs = store.processes.lock().map_err(|e| e.to_string())?;
    Ok(procs
        .values()
        .map(|p| ProcessInfo {
            pid: p.pid,
            task_id: p.task_id,
            command: p.command.clone(),
            start_time: p.start_time,
        })
        .collect())
}

#[tauri::command]
pub fn kill_process(pid: u32, store: State<'_, ProcessStore>) -> Result<bool, String> {
    #[cfg(windows)]
    {
        std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F", "/T"])
            .output()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }
    }

    let mut procs = store.processes.lock().map_err(|e| e.to_string())?;
    procs.remove(&pid);
    Ok(true)
}
