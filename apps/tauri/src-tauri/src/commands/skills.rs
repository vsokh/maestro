use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::ProjectPath;

#[derive(serde::Serialize)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    #[serde(rename = "type")]
    pub skill_type: String,
}

fn skills_dir(project: &str) -> PathBuf {
    PathBuf::from(project).join(".claude").join("skills")
}

fn agents_dir(project: &str) -> PathBuf {
    PathBuf::from(project).join(".claude").join("agents")
}

fn skills_config_path(project: &str) -> PathBuf {
    PathBuf::from(project)
        .join(".maestro")
        .join("skills.json")
}

#[tauri::command]
pub fn discover_skills(project: State<'_, ProjectPath>) -> Result<Vec<SkillInfo>, String> {
    let mut results = Vec::new();

    // Discover skills
    let sd = skills_dir(&project.get());
    if sd.exists() {
        if let Ok(entries) = fs::read_dir(&sd) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    // Try to read description from SKILL.md or skill.md
                    let desc = read_skill_description(&entry.path());
                    results.push(SkillInfo {
                        name,
                        description: desc,
                        skill_type: "skill".to_string(),
                    });
                }
            }
        }
    }

    // Discover agents
    let ad = agents_dir(&project.get());
    if ad.exists() {
        if let Ok(entries) = fs::read_dir(&ad) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let desc = read_skill_description(&entry.path());
                    results.push(SkillInfo {
                        name,
                        description: desc,
                        skill_type: "agent".to_string(),
                    });
                }
            }
        }
    }

    Ok(results)
}

fn read_skill_description(dir: &std::path::Path) -> String {
    // Look for SKILL.md, skill.md, or AGENT.md
    for name in &["SKILL.md", "skill.md", "AGENT.md", "agent.md"] {
        let path = dir.join(name);
        if let Ok(content) = fs::read_to_string(&path) {
            // Extract first non-empty, non-heading line as description
            for line in content.lines() {
                let trimmed = line.trim();
                if !trimmed.is_empty() && !trimmed.starts_with('#') {
                    return trimmed.to_string();
                }
            }
        }
    }
    String::new()
}

#[tauri::command]
pub fn deploy_skill(
    skill_name: String,
    filename: String,
    content: String,
    project: State<'_, ProjectPath>,
) -> Result<bool, String> {
    let dir = skills_dir(&project.get()).join(&skill_name);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(&filename);

    // Check if content is the same — skip write if unchanged
    if let Ok(existing) = fs::read_to_string(&path) {
        if existing == content {
            return Ok(false); // Not deployed (already up to date)
        }
    }

    fs::write(&path, &content).map_err(|e| e.to_string())?;
    Ok(true) // Deployed
}

#[tauri::command]
pub fn deploy_agent(
    agent_name: String,
    filename: String,
    content: String,
    project: State<'_, ProjectPath>,
) -> Result<bool, String> {
    let dir = agents_dir(&project.get()).join(&agent_name);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(&filename);

    if let Ok(existing) = fs::read_to_string(&path) {
        if existing == content {
            return Ok(false);
        }
    }

    fs::write(&path, &content).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn read_skills_config(project: State<'_, ProjectPath>) -> Result<Value, String> {
    let path = skills_config_path(&project.get());
    if !path.exists() {
        return Ok(serde_json::json!(null));
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_skills_config(config: Value, project: State<'_, ProjectPath>) -> Result<bool, String> {
    let path = skills_config_path(&project.get());
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(true)
}
