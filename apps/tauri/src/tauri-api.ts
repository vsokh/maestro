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

  // Minimal WebSocket-compatible object.
  // useConnection only calls .close() and does identity checks.
  return {
    close: () => {
      for (const p of unlisteners) {
        p.then((unlisten) => unlisten());
      }
    },
    readyState: 1,
  } as unknown as WebSocket;
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

  // Quality
  readQualityLatest: () => invoke<QualityReport | null>('read_json_file', { relPath: 'quality/latest.json' }).catch(() => null),
  readQualityHistory: () => invoke<QualityHistoryEntry[]>('read_json_file', { relPath: 'quality/history.json' }).catch(() => []),

  // Release
  readReleases: () => invoke<ReleaseEntry[]>('read_json_file', { relPath: 'release/releases.json' }).catch(() => []),
  readStability: () => invoke<StabilityAssessment | null>('read_json_file', { relPath: 'release/stability.json' }).catch(() => null),
  readChangelog: () => invoke<{ sections: ChangelogSection[] }>('read_changelog'),

  // Errors
  readErrorsLatest: () => invoke<ErrorsReport | null>('read_json_file', { relPath: 'errors/latest.json' }).catch(() => null),
  readErrorsHistory: () => invoke<ErrorsHistoryEntry[]>('read_json_file', { relPath: 'errors/history.json' }).catch(() => []),

  // Attachments
  saveAttachment: async (taskId: number, filename: string, blob: Blob): Promise<string> => {
    const buffer = await blob.arrayBuffer();
    const data = Array.from(new Uint8Array(buffer));
    return invoke<string>('save_attachment', { taskId, filename, data });
  },
  deleteAttachment: async (taskId: number, filename: string) => {
    await invoke<boolean>('delete_attachment', { taskId: taskId as unknown as number, filename });
    return { ok: true as const };
  },
  getAttachmentUrl: (taskId: number, filename: string) => {
    // In Tauri, we'll resolve the path at render time via invoke
    // For now return a placeholder — components should use convertFileSrc() for real rendering
    return `tauri://localhost/.devmanager/attachments/${taskId}/${encodeURIComponent(filename)}`;
  },

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
  launchTerminal: async (taskId: number, command: string, engine?: string, title?: string) => {
    await invoke<boolean>('launch_terminal', { taskId, command, engine, title });
    return { ok: true as const };
  },
  listProcesses: () => invoke<Array<{ pid: number; taskId: number; engine: string; startedAt: string }>>('list_processes'),
  getBufferedOutput: async () => {
    // Output is streamed via Tauri events — no buffering API needed
    return {} as Record<string, { output: Array<{ text: string; stream: string; time: number }>; running: boolean; exitCode?: number }>;
  },
  killProcess: async (pid: number) => {
    await invoke<boolean>('kill_process', { pid });
    return { ok: true as const };
  },

  // Info
  getInfo: () => invoke<{ projectPath: string; projectName: string }>('get_project_info'),

  // Projects
  listProjects: () => invoke<Array<{ path: string; name: string; active: boolean }>>('list_projects'),
  switchProject: async (path: string) => {
    await invoke<boolean>('set_project_path', { path });
    await invoke<void>('watch_project');
    const info = await invoke<{ projectPath: string; projectName: string }>('get_project_info');
    return { ok: true as const, projectPath: info.projectPath, projectName: info.projectName };
  },

  // Split tasks
  splitTasks: (text: string) => invoke<{ tasks: Array<{ name: string; fullName: string; description: string; group?: string }> }>('split_tasks', { text }),

  // Git
  gitStatus: () => invoke<{ branch: string | null; unpushed: number; commits?: Array<{ hash: string; message: string }>; error?: string }>('git_status'),
  gitPush: () => invoke<{ ok: boolean; output: string }>('git_push').then(r => ({ ok: true as const, output: r.output })),

  // Browse
  browseNative: () => invoke<{ path: string | null }>('browse_native'),
  browse: (path?: string) => invoke<{
    current: string;
    parent: string | null;
    dirs: Array<{ name: string; path: string; isProject: boolean }>;
  }>('browse_directories', { path: path || null }),
};
