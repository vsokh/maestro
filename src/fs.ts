import { ORCHESTRATOR_SKILL_TEMPLATE } from './orchestrator.ts';
import { CODEHEALTH_SKILL_TEMPLATE } from './codehealth.ts';
import { AUTOFIX_SKILL_TEMPLATE } from './autofix.ts';
import { api } from './api.ts';
import type { StateData, ProgressEntry, SkillInfo, SkillsConfig } from './types';
import type { ProjectTemplate } from './templates.ts';

export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

export function createDefaultState(projectName: string): StateData {
  return {
    savedAt: new Date().toISOString(),
    project: projectName,
    tasks: [],
    features: [],
    queue: [],
    taskNotes: {},
    activity: [{ id: 'act_init', time: Date.now(), label: 'Project initialized' }],
  };
}

export async function readState(): Promise<{ data: StateData; lastModified: number } | null> {
  try {
    return await api.readState();
  } catch (err) {
    console.error('readState failed:', err);
    return null;
  }
}

export async function writeState(data: StateData): Promise<boolean> {
  try {
    await api.writeState(data);
    return true;
  } catch (err) {
    console.error('writeState failed:', err);
    return false;
  }
}

export async function readProgressFiles(): Promise<Record<string, ProgressEntry>> {
  try {
    return await api.readProgress();
  } catch (err) {
    console.error('readProgressFiles failed:', err);
    return {};
  }
}

export async function deleteProgressFile(taskId: string | number): Promise<void> {
  try {
    await api.deleteProgress(taskId);
  } catch (err) {
    console.error('deleteProgressFile failed:', err);
  }
}

export async function discoverSkillsAndAgents(): Promise<SkillInfo[]> {
  try {
    return await api.discoverSkills();
  } catch (err) {
    console.error('discoverSkillsAndAgents failed:', err);
    return [];
  }
}

export async function ensureOrchestratorSkill(): Promise<boolean> {
  try {
    const result = await api.deploySkill('orchestrator', 'SKILL.md', ORCHESTRATOR_SKILL_TEMPLATE);
    return result.deployed;
  } catch (err) {
    console.error('ensureOrchestratorSkill failed:', err);
    return false;
  }
}

export async function ensureCodehealthSkill(): Promise<boolean> {
  try {
    const result = await api.deploySkill('codehealth', 'skill.md', CODEHEALTH_SKILL_TEMPLATE);
    return result.deployed;
  } catch (err) {
    console.error('ensureCodehealthSkill failed:', err);
    return false;
  }
}

export async function ensureAutofixSkill(): Promise<boolean> {
  try {
    const result = await api.deploySkill('autofix', 'SKILL.md', AUTOFIX_SKILL_TEMPLATE);
    return result.deployed;
  } catch (err) {
    console.error('ensureAutofixSkill failed:', err);
    return false;
  }
}

export async function syncSkills(): Promise<void> {
  await ensureOrchestratorSkill();
  await ensureCodehealthSkill();
  await ensureAutofixSkill();
}

export async function readSkillsConfig(): Promise<SkillsConfig | null> {
  try {
    return await api.readSkillsConfig();
  } catch (err) {
    console.error('readSkillsConfig failed:', err);
    return null;
  }
}

export async function writeSkillsConfig(config: SkillsConfig): Promise<boolean> {
  try {
    await api.writeSkillsConfig(config);
    return true;
  } catch (err) {
    console.error('writeSkillsConfig failed:', err);
    return false;
  }
}

export async function saveAttachment(taskId: number, filename: string, blob: Blob): Promise<string> {
  return await api.saveAttachment(taskId, filename, blob);
}

export async function deleteAttachment(taskId: number, filename: string): Promise<void> {
  try {
    await api.deleteAttachment(taskId, filename);
  } catch (err) {
    console.error('deleteAttachment failed:', err);
  }
}

export function readAttachmentUrl(taskId: number, filename: string): string {
  return api.getAttachmentUrl(taskId, filename);
}

export async function snapshotState(): Promise<string | null> {
  try {
    const result = await api.snapshotState();
    return result.filename;
  } catch (err) {
    console.error('snapshotState failed:', err);
    return null;
  }
}

export async function listBackups(): Promise<Array<{ name: string; lastModified: number }>> {
  try {
    const result = await api.listBackups();
    return result.backups;
  } catch (err) {
    console.error('listBackups failed:', err);
    return [];
  }
}

export async function applyTemplate(
  projectName: string,
  template: ProjectTemplate,
): Promise<StateData> {
  // Deploy template skills via bridge server
  for (const skill of template.skills) {
    try {
      await api.deploySkill(skill.name, skill.filename, skill.content);
    } catch (err) {
      console.error(`Failed to deploy skill ${skill.name}:`, err);
    }
  }

  // Deploy template agents via bridge server
  for (const agent of template.agents) {
    try {
      await api.deployAgent(agent.name, agent.filename, agent.content);
    } catch (err) {
      console.error(`Failed to deploy agent ${agent.name}:`, err);
    }
  }

  // Build initial state with epics and starter tasks
  const epics = template.epics.map((e, i) => ({ name: e.name, color: i }));
  const tasks: StateData['tasks'] = [];
  let taskId = 1;
  for (const epic of template.epics) {
    for (const taskName of (epic.defaultTasks || [])) {
      tasks.push({
        id: taskId++,
        name: taskName,
        fullName: taskName,
        status: 'pending' as const,
        group: epic.name,
        skills: template.skills.map(s => s.name),
        createdAt: new Date().toISOString(),
      });
    }
  }

  return {
    savedAt: new Date().toISOString(),
    project: projectName,
    tasks,
    queue: [],
    taskNotes: {},
    activity: [
      { id: 'act_template', time: Date.now(), label: `Project initialized with ${template.name} template` },
    ],
    epics,
  };
}
