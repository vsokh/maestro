use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::ProjectPath;

const ALLOWED_EXTENSIONS: &[&str] = &[".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
const MAX_SIZE: usize = 10 * 1024 * 1024; // 10 MB

fn attachments_dir(project: &str, task_id: i64) -> PathBuf {
    PathBuf::from(project)
        .join(".maestro")
        .join("attachments")
        .join(task_id.to_string())
}

#[tauri::command]
pub fn save_attachment(
    task_id: i64,
    filename: String,
    data: Vec<u8>,
    project: State<'_, ProjectPath>,
) -> Result<String, String> {
    // Validate extension
    let lower = filename.to_lowercase();
    if !ALLOWED_EXTENSIONS.iter().any(|ext| lower.ends_with(ext)) {
        return Err(format!("Invalid file extension. Allowed: {:?}", ALLOWED_EXTENSIONS));
    }

    if data.len() > MAX_SIZE {
        return Err("File too large (max 10 MB)".to_string());
    }

    // Sanitize filename
    let safe_name = filename
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == '_')
        .collect::<String>();
    if safe_name.is_empty() {
        return Err("Invalid filename".to_string());
    }

    let dir = attachments_dir(&project.get(), task_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let path = dir.join(&safe_name);
    fs::write(&path, &data).map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_attachment_path(
    task_id: i64,
    filename: String,
    project: State<'_, ProjectPath>,
) -> Result<String, String> {
    let path = attachments_dir(&project.get(), task_id).join(&filename);
    if !path.exists() {
        return Err("not_found".to_string());
    }
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_attachment(
    task_id: i64,
    filename: String,
    project: State<'_, ProjectPath>,
) -> Result<bool, String> {
    let path = attachments_dir(&project.get(), task_id).join(&filename);
    if !path.exists() {
        return Err("not_found".to_string());
    }
    fs::remove_file(&path).map_err(|e| e.to_string())?;
    Ok(true)
}
