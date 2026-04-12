// Tauri IPC API — same interface as src/api.ts but uses invoke() instead of fetch()

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  StateData, ProgressEntry, SkillInfo, SkillsConfig,
  QualityReport, QualityHistoryEntry, WebSocketMessage,
  ReleaseEntry, StabilityAssessment, ChangelogSection,
  ErrorsReport, ErrorsHistoryEntry,
} from '../../src/types';

// WebSocket replacement: Tauri event listeners
// The Rust watcher emits dm:state, dm:progress, dm:quality, dm:errors, dm:output, dm:exit

const VALID_EVENT_TYPES = ['state', 'progress', 'quality', 'errors', 'output', 'exit'] as const;

function isValidMessage(data: unknown): data is WebSocketMessage {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const msg = data as Record<string, unknown>;
  return typeof msg.type === 'string' && (VALID_EVENT_TYPES as readonly string[]).includes(msg.type);
}

export function connectWebSocket(
  onMessage: (msg: WebSocketMessage) => void,
  _onClose?: () => void,
): WebSocket {
  const unlisteners: Promise<UnlistenFn>[] = [];

  for (const eventType of VALID_EVENT_TYPES) {
    unlisteners.push(
      listen<WebSocketMessage>(`dm:${eventType}`, (event) => {
        if (isValidMessage(event.payload)) {
          onMessage(event.payload);
        }
      }),
    );
  }

  // Return a minimal WebSocket-compatible object.
  // useConnection only calls .close() and does identity checks.
  const fake = {
    close: () => {
      for (const p of unlisteners) {
        p.then((unlisten) => unlisten());
      }
    },
    readyState: 1,
  } as unknown as WebSocket;

  return fake;
}

export const api = {
  // State
  readState: () => invoke<{ data: StateData; lastModified: number }>('read_state'),
  writeState: async (data: StateData, lastModified?: number): Promise<{ ok: true; lastModified: number } | { conflict: true; data: StateData; lastModified: number }> => {
    try {
      const result = await invoke<{ ok: boolean; lastModified: number }>('write_state', {
        data,
        lastModified: lastModified || 0,
      });
      return { ok: true, lastModified: result.lastModified };
    } catch (err: unknown) {
      // Conflict errors come as JSON strings from Rust
      if (typeof err === 'string') {
        try {
          const parsed = JSON.parse(err);
          if (parsed.error?.includes('Conflict')) {
            return { conflict: true, data: parsed.data, lastModified: parsed.lastModified };
          }
        } catch { /* not JSON, rethrow */ }
      }
      throw err;
    }
  },

  // Progress
  readProgress: () => invoke<Record<string, ProgressEntry>>('read_progress'),
  deleteProgress: (taskId: string | number) => invoke<boolean>('delete_progress', { taskId: String(taskId) }),

  // Skills
  discoverSkills: () => invoke<SkillInfo[]>('discover_skills'),
  deploySkill: async (skillName: string, filename: string, content: string) => {
    const deployed = await invoke<boolean>('deploy_skill', { skillName, filename, content });
    return { ok: true as const, deployed };
  },
  deployAgent: async (agentName: string, filename: string, content: string) => {
    const deployed = await invoke<boolean>('deploy_agent', { agentName, filename, content });
    return { ok: true as const, deployed };
  },
  readSkillsConfig: () => invoke<SkillsConfig | null>('read_skills_config'),
  writeSkillsConfig: async (config: SkillsConfig) => {
    await invoke<boolean>('write_skills_config', { config });
    return { ok: true as const };
  },

  // Quality (read from .devmanager/quality/ directly)
  readQualityLatest: () => invoke<QualityReport | null>('read_json_file', { relPath: 'quality/latest.json' }).catch(() => null),
  readQualityHistory: () => invoke<QualityHistoryEntry[]>('read_json_file', { relPath: 'quality/history.json' }).catch(() => []),

  // Release (read from .devmanager/release/ directly)
  readReleases: () => invoke<ReleaseEntry[]>('read_json_file', { relPath: 'release/releases.json' }).catch(() => []),
  readStability: () => invoke<StabilityAssessment | null>('read_json_file', { relPath: 'release/stability.json' }).catch(() => null),
  readChangelog: async (): Promise<{ sections: ChangelogSection[] }> => {
    // Changelog parsing happens client-side in Tauri (or we skip it for MVP)
    return { sections: [] };
  },

  // Errors
  readErrorsLatest: () => invoke<ErrorsReport | null>('read_json_file', { relPath: 'errors/latest.json' }).catch(() => null),
  readErrorsHistory: () => invoke<ErrorsHistoryEntry[]>('read_json_file', { relPath: 'errors/history.json' }).catch(() => []),

  // Attachments — for MVP, use file:// URLs
  saveAttachment: async (_taskId: number, _filename: string, _blob: Blob): Promise<string> => {
    // TODO: Phase 3 — save to .devmanager/attachments/{taskId}/
    throw new Error('Attachments not yet supported in desktop app');
  },
  deleteAttachment: async (_taskId: number, _filename: string) => {
    return { ok: true as const };
  },
  getAttachmentUrl: (taskId: number, filename: string) =>
    `file://.devmanager/attachments/${taskId}/${encodeURIComponent(filename)}`,

  // Backups
  listBackups: async () => {
    const backups = await invoke<Array<{ name: string; lastModified: number }>>('list_backups');
    return { backups };
  },
  snapshotState: async () => {
    const filename = await invoke<string>('create_snapshot');
    return { filename };
  },
  restoreBackup: async (filename: string) => {
    await invoke<boolean>('restore_backup', { filename });
    return { ok: true as const };
  },

  // Launch
  launch: async (taskId: number, command: string, engine?: string) => {
    const result = await invoke<{ pid: number; taskId: number; command: string }>('launch_process', {
      taskId,
      command,
      engine,
    });
    return { pid: result.pid };
  },
  launchTerminal: async (_taskId: number, _command: string, _engine?: string, _title?: string) => {
    // TODO: Phase 2 — open OS terminal
    return { ok: true as const };
  },
  listProcesses: () => invoke<Array<{ pid: number; taskId: number; engine: string; startedAt: string }>>('list_processes'),
  getBufferedOutput: async () => {
    // Output is streamed via events in Tauri, no buffering API needed for MVP
    return {} as Record<string, { output: Array<{ text: string; stream: string; time: number }>; running: boolean; exitCode?: number }>;
  },
  killProcess: async (pid: number) => {
    await invoke<boolean>('kill_process', { pid });
    return { ok: true as const };
  },

  // Info
  getInfo: () => invoke<{ projectPath: string; projectName: string }>('get_project_info'),

  // Projects
  listProjects: async () => [] as Array<{ path: string; name: string; active: boolean }>,
  switchProject: async (path: string) => {
    await invoke<boolean>('set_project_path', { path });
    await invoke<void>('watch_project');
    const info = await invoke<{ projectPath: string; projectName: string }>('get_project_info');
    return { ok: true as const, projectPath: info.projectPath, projectName: info.projectName };
  },

  // Split tasks — requires Claude CLI, call directly
  splitTasks: async (_text: string) => {
    // TODO: Phase 2 — spawn claude CLI for task splitting
    return { tasks: [] as Array<{ name: string; fullName: string; description: string; group?: string }> };
  },

  // Git
  gitStatus: () => invoke<{ branch: string | null; unpushed: number; commits?: Array<{ hash: string; message: string }>; error?: string }>('git_status'),
  gitPush: () => invoke<{ ok: boolean; output: string }>('git_push').then(r => ({ ok: true as const, output: r.output })),

  // Browse — not needed in desktop app (can use native dialog)
  browseNative: async () => ({ path: null as string | null }),
  browse: async (_path?: string) => ({
    current: '',
    parent: null as string | null,
    dirs: [] as Array<{ name: string; path: string; isProject: boolean }>,
  }),
};
