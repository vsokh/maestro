use std::process::Command;
use tauri::State;

use crate::ProjectPath;

#[derive(serde::Serialize)]
pub struct GitStatusResult {
    pub branch: Option<String>,
    pub unpushed: i32,
    pub commits: Vec<GitCommit>,
    pub error: Option<String>,
}

#[derive(serde::Serialize)]
pub struct GitCommit {
    pub hash: String,
    pub message: String,
}

#[tauri::command]
pub fn git_status(project: State<'_, ProjectPath>) -> Result<GitStatusResult, String> {
    let cwd = &project.get();

    // Get current branch
    let branch = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(cwd)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        });

    // Count unpushed commits
    let unpushed_output = Command::new("git")
        .args(["rev-list", "--count", "@{u}..HEAD"])
        .current_dir(cwd)
        .output();

    let unpushed = unpushed_output
        .ok()
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8_lossy(&o.stdout)
                    .trim()
                    .parse::<i32>()
                    .ok()
            } else {
                None
            }
        })
        .unwrap_or(0);

    // Get unpushed commit details
    let mut commits = Vec::new();
    if unpushed > 0 {
        let log_output = Command::new("git")
            .args(["log", "--oneline", &format!("@{{u}}..HEAD")])
            .current_dir(cwd)
            .output();

        if let Ok(output) = log_output {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                for line in text.lines() {
                    if let Some((hash, message)) = line.split_once(' ') {
                        commits.push(GitCommit {
                            hash: hash.to_string(),
                            message: message.to_string(),
                        });
                    }
                }
            }
        }
    }

    Ok(GitStatusResult {
        branch,
        unpushed,
        commits,
        error: None,
    })
}

#[derive(serde::Serialize)]
pub struct GitPushResult {
    pub ok: bool,
    pub output: String,
}

#[tauri::command]
pub fn git_push(project: State<'_, ProjectPath>) -> Result<GitPushResult, String> {
    let output = Command::new("git")
        .args(["push"])
        .current_dir(&project.get())
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(GitPushResult {
            ok: true,
            output: if stdout.is_empty() { stderr } else { stdout },
        })
    } else {
        Err(format!("git push failed: {}", stderr))
    }
}
