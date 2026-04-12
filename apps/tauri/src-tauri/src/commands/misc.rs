use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::State;

use crate::ProjectPath;

/// Invoke Claude CLI to split scratchpad text into structured tasks.
#[tauri::command]
pub fn split_tasks(text: String, project: State<'_, ProjectPath>) -> Result<serde_json::Value, String> {
    if text.len() > 50_000 {
        return Err("Text too long (max 50000 chars)".to_string());
    }

    let prompt = format!(
        "Split this into tasks. Return ONLY a JSON array where each item has: name (short), fullName (descriptive), description, group. No markdown, no explanation, just the JSON array.\n\n{}",
        text
    );

    let output = Command::new("claude")
        .args(["-p", &prompt, "--output-format", "json"])
        .current_dir(&project.get())
        .output()
        .map_err(|e| format!("Failed to run claude CLI: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude CLI failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Try to parse the result — Claude returns JSON with a "result" field
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&stdout) {
        // If it's wrapped in {"result": "..."}, extract and parse the inner JSON
        if let Some(result_str) = parsed.get("result").and_then(|r| r.as_str()) {
            // Strip markdown code fences if present
            let clean = result_str
                .trim()
                .trim_start_matches("```json")
                .trim_start_matches("```")
                .trim_end_matches("```")
                .trim();
            if let Ok(tasks) = serde_json::from_str::<serde_json::Value>(clean) {
                return Ok(serde_json::json!({ "tasks": tasks }));
            }
        }
        // If it's already an array
        if parsed.is_array() {
            return Ok(serde_json::json!({ "tasks": parsed }));
        }
        // If it has a tasks field already
        if parsed.get("tasks").is_some() {
            return Ok(parsed);
        }
    }

    Err("Failed to parse Claude output as task list".to_string())
}

/// Parse CHANGELOG.md from the project root into structured sections.
#[tauri::command]
pub fn read_changelog(project: State<'_, ProjectPath>) -> Result<serde_json::Value, String> {
    let path = PathBuf::from(project.get()).join("CHANGELOG.md");
    if !path.exists() {
        return Ok(serde_json::json!({ "sections": [] }));
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut sections = Vec::new();
    let mut current_section: Option<serde_json::Map<String, serde_json::Value>> = None;
    let mut current_group: Option<(String, Vec<String>)> = None;
    let mut groups: Vec<serde_json::Value> = Vec::new();

    for line in content.lines() {
        // ## [version] - date  or  ## version - date
        if line.starts_with("## ") {
            // Flush previous section
            if let Some(ref mut section) = current_section {
                if let Some((name, items)) = current_group.take() {
                    groups.push(serde_json::json!({ "name": name, "items": items }));
                }
                section.insert("groups".to_string(), serde_json::json!(groups.clone()));
                sections.push(serde_json::Value::Object(section.clone()));
                groups.clear();
            }

            let heading = line[3..].trim();
            let (version, date) = parse_changelog_heading(heading);
            let mut section = serde_json::Map::new();
            section.insert("version".to_string(), serde_json::json!(version));
            section.insert("date".to_string(), serde_json::json!(date));
            current_section = Some(section);
            current_group = None;
        } else if line.starts_with("### ") && current_section.is_some() {
            // Flush previous group
            if let Some((name, items)) = current_group.take() {
                groups.push(serde_json::json!({ "name": name, "items": items }));
            }
            let group_name = line[4..].trim().to_string();
            current_group = Some((group_name, Vec::new()));
        } else if line.starts_with("- ") || line.starts_with("* ") {
            if let Some((_, ref mut items)) = current_group {
                items.push(line[2..].trim().to_string());
            }
        }
    }

    // Flush last section
    if let Some(ref mut section) = current_section {
        if let Some((name, items)) = current_group.take() {
            groups.push(serde_json::json!({ "name": name, "items": items }));
        }
        section.insert("groups".to_string(), serde_json::json!(groups));
        sections.push(serde_json::Value::Object(section.clone()));
    }

    Ok(serde_json::json!({ "sections": sections }))
}

fn parse_changelog_heading(heading: &str) -> (String, String) {
    // Formats: "[1.0.0] - 2024-01-01", "1.0.0 - 2024-01-01", "[Unreleased]"
    let cleaned = heading.trim_start_matches('[').replace(']', "");
    if let Some((version, date)) = cleaned.split_once(" - ") {
        (version.trim().to_string(), date.trim().to_string())
    } else {
        (cleaned.trim().to_string(), String::new())
    }
}
