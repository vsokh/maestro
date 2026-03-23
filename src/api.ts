// Bridge server API client

import type { StateData, ProgressEntry, SkillInfo, SkillsConfig, QualityReport, QualityHistoryEntry } from './types';

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
  onMessage: (msg: any) => void,
  onClose?: () => void,
): WebSocket {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch { /* ignore parse errors */ }
  };
  ws.onclose = () => { onClose?.(); };
  return ws;
}

// API functions (replace fs.ts functions)
export const api = {
  // State
  readState: () => get<{ data: StateData; lastModified: number }>('/api/state'),
  writeState: (data: StateData) => put<{ ok: true }>('/api/state', data),

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
  listProcesses: () => get<Array<{ pid: number; taskId: number; engine: string; startedAt: string }>>('/api/launch'),
  killProcess: (pid: number) => del<{ ok: true }>(`/api/launch/${pid}`),

  // Info
  getInfo: () => get<{ projectPath: string; projectName: string }>('/api/info'),

  // Projects (multi-project)
  listProjects: () => get<Array<{ path: string; name: string; active: boolean }>>('/api/projects'),
  switchProject: (path: string) => put<{ ok: true; projectPath: string; projectName: string }>('/api/project', { path }),

  // Browse (folder picker)
  browseNative: () => post<{ path: string | null; cancelled?: boolean }>('/api/browse/native'),
  browse: (path?: string) => get<{
    current: string;
    parent: string | null;
    dirs: Array<{ name: string; path: string; isProject: boolean }>;
  }>(`/api/browse${path ? '?path=' + encodeURIComponent(path) : ''}`),
};
