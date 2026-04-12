/// Native folder picker using OS-level dialogs.
/// On Windows: uses PowerShell's FolderBrowserDialog.
/// On macOS/Linux: uses osascript / zenity.

#[tauri::command]
pub fn browse_native() -> Result<serde_json::Value, String> {
    let path = native_folder_dialog()?;
    Ok(serde_json::json!({ "path": path }))
}

#[cfg(windows)]
fn native_folder_dialog() -> Result<Option<String>, String> {
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = 'Select project folder'; $d.ShowNewFolderButton = $true; if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath } else { '' }"#,
        ])
        .output()
        .map_err(|e| format!("Failed to open folder dialog: {}", e))?;

    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        Ok(None) // User cancelled
    } else {
        Ok(Some(path))
    }
}

#[cfg(target_os = "macos")]
fn native_folder_dialog() -> Result<Option<String>, String> {
    let output = std::process::Command::new("osascript")
        .args([
            "-e",
            r#"set theFolder to choose folder with prompt "Select project folder"
            POSIX path of theFolder"#,
        ])
        .output()
        .map_err(|e| format!("Failed to open folder dialog: {}", e))?;

    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() || !output.status.success() {
        Ok(None)
    } else {
        Ok(Some(path))
    }
}

#[cfg(all(not(windows), not(target_os = "macos")))]
fn native_folder_dialog() -> Result<Option<String>, String> {
    let output = std::process::Command::new("zenity")
        .args(["--file-selection", "--directory", "--title=Select project folder"])
        .output()
        .map_err(|e| format!("Failed to open folder dialog: {}", e))?;

    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() || !output.status.success() {
        Ok(None)
    } else {
        Ok(Some(path))
    }
}
