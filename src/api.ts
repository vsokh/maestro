// Bridge server API client

import type { StateData, ProgressEntry, SkillInfo, SkillsConfig, QualityReport, QualityHistoryEntry, WebSocketMessage, ReleaseEntry, StabilityAssessment, ChangelogSection } from './types';

const BASE_URL = ''; // Same origin (vite proxy in dev, served by bridge in prod)

// HTTP helpers
async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE_URL + path);
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path}: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path}: ${res.status}`);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(BASE_URL + path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path}: ${res.status}`);
  return res.json();
}

// WebSocket connection
export function connectWebSocket(
  onMessage: (msg: WebSocketMessage) => void,
  onClose?: () => void,
): WebSocket {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch (err) { console.warn('[ws] Failed to parse message:', err); }
  };
  ws.onclose = () => { onClose?.(); };
  return ws;
}

// API functions (replace fs.ts functions)
export const api = {
  // State
  readState: () => get<{ data: StateData; lastModified: number }>('/api/state'),
  writeState: async (data: StateData, lastModified?: number): Promise<{ ok: true; lastModified: number } | { conflict: true; data: StateData; lastModified: number }> => {
    const body = lastModified ? { ...data, _lastModified: lastModified } : data;
    const res = await fetch(BASE_URL + '/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 409) {
      const conflict = await res.json();
      return { conflict: true, data: conflict.data, lastModified: conflict.lastModified };
    }
    if (!res.ok) throw new Error(`PUT /api/state: ${res.status}`);
    const result = await res.json();
    return { ok: true, lastModified: result.lastModified };
  },

  // Progress
  readProgress: () => get<Record<string, ProgressEntry>>('/api/progress'),
  deleteProgress: (taskId: string | number) => del<{ ok: true }>(`/api/progress/${taskId}`),

  // Skills
  discoverSkills: () => get<SkillInfo[]>('/api/skills'),
  deploySkill: (skillName: string, filename: string, content: string) =>
    post<{ ok: true; deployed: boolean }>('/api/skills/deploy', { skillName, filename, content }),
  deployAgent: (agentName: string, filename: string, content: string) =>
    post<{ ok: true; deployed: boolean }>('/api/agents/deploy', { agentName, filename, content }),
  readSkillsConfig: () => get<SkillsConfig | null>('/api/skills-config'),
  writeSkillsConfig: (config: SkillsConfig) => put<{ ok: true }>('/api/skills-config', config),

  // Quality
  readQualityLatest: () => get<QualityReport | null>('/api/quality/latest'),
  readQualityHistory: () => get<QualityHistoryEntry[]>('/api/quality/history'),

  // Release
  readReleases: () => get<ReleaseEntry[]>('/api/release/releases'),
  readStability: () => get<StabilityAssessment | null>('/api/release/stability'),
  readChangelog: () => get<{ sections: ChangelogSection[] }>('/api/release/changelog'),

  // Attachments
  saveAttachment: async (taskId: number, filename: string, blob: Blob): Promise<string> => {
    const res = await fetch(`/api/attachments/${taskId}?name=${encodeURIComponent(filename)}`, {
      method: 'POST',
      body: blob,
    });
    if (!res.ok) throw new Error('Upload failed');
    const { path } = await res.json();
    return path;
  },
  deleteAttachment: (taskId: number, filename: string) =>
    del<{ ok: true }>(`/api/attachments/${taskId}/${encodeURIComponent(filename)}`),
  getAttachmentUrl: (taskId: number, filename: string) =>
    `/api/attachments/${taskId}/${encodeURIComponent(filename)}`,

  // Backups
  listBackups: () => get<{ backups: Array<{ name: string; lastModified: number }> }>('/api/backups'),
  snapshotState: () => post<{ filename: string }>('/api/backups/snapshot'),
  restoreBackup: (filename: string) => post<{ ok: true }>('/api/backups/restore', { filename }),

  // Launch (headless)
  launch: (taskId: number, command: string, engine?: string) =>
    post<{ pid: number }>('/api/launch', { taskId, command, engine }),
  launchTerminal: (taskId: number, command: string, engine?: string, title?: string) =>
    post<{ ok: true }>('/api/launch/terminal', { taskId, command, engine, title }),
  listProcesses: () => get<Array<{ pid: number; taskId: number; engine: string; startedAt: string }>>('/api/launch'),
  getBufferedOutput: () => get<Record<string, { output: Array<{ text: string; stream: string; time: number }>; running: boolean; exitCode?: number }>>('/api/launch/output'),
  killProcess: (pid: number) => del<{ ok: true }>(`/api/launch/${pid}`),

  // Info
  getInfo: () => get<{ projectPath: string; projectName: string }>('/api/info'),

  // Projects (multi-project)
  listProjects: () => get<Array<{ path: string; name: string; active: boolean }>>('/api/projects'),
  switchProject: (path: string) => put<{ ok: true; projectPath: string; projectName: string }>('/api/project', { path }),

  // Split scratchpad into tasks
  splitTasks: (text: string) => post<{
    tasks: Array<{ name: string; fullName: string; description: string; group?: string }>;
  }>('/api/split-tasks', { text }),

  // Git
  gitStatus: () => get<{ branch: string | null; unpushed: number; commits?: Array<{ hash: string; message: string }>; error?: string }>('/api/git/status'),
  gitPush: () => post<{ ok: true; output: string }>('/api/git/push'),

  // Browse (folder picker)
  browseNative: () => post<{ path: string | null; cancelled?: boolean }>('/api/browse/native'),
  browse: (path?: string) => get<{
    current: string;
    parent: string | null;
    dirs: Array<{ name: string; path: string; isProject: boolean }>;
  }>(`/api/browse${path ? '?path=' + encodeURIComponent(path) : ''}`),
};
