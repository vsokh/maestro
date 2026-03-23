import { useState, useCallback, useRef, useEffect } from 'react';
import type { StateData, Activity, Task, SkillsConfig, SkillInfo } from '../types';
import type { ProjectTemplate } from '../templates.ts';
import { api } from '../api.ts';
import { connectWebSocket } from '../api.ts';
import {
  readState,
  writeState,
  createDefaultState,
  syncSkills,
  readProgressFiles,
  deleteProgressFile,
  discoverSkillsAndAgents,
  readSkillsConfig,
  writeSkillsConfig,
  applyTemplate,
} from '../fs.ts';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'synced' | 'error' | 'template-picker';

export interface MergeResult {
  data: StateData;
  needsWrite: boolean;
  hasChanges: boolean;
  completedTaskIds: number[];
  arrangeCompleted: boolean;
}

export function mergeProgressIntoState(
  stateData: StateData,
  progressEntries: Record<string | number, import('../types').ProgressEntry>,
): MergeResult {
  if (Object.keys(progressEntries).length === 0) {
    return { data: stateData, needsWrite: false, hasChanges: false, completedTaskIds: [], arrangeCompleted: false };
  }

  const tasks: Task[] = [...(stateData.tasks || [])];
  const activity: Activity[] = [...(stateData.activity || [])];
  let queue = [...(stateData.queue || [])];
  let needsWrite = false;
  let hasChanges = false;
  const completedTaskIds: number[] = [];
  let arrangeCompleted = false;

  for (const [taskId, prog] of Object.entries(progressEntries)) {
    if (taskId === 'arrange' && prog.status === 'done') {
      activity.unshift({
        id: 'act_' + Date.now() + '_arrange',
        time: Date.now(),
        label: prog.label || 'Tasks arranged into dependency graph',
      });
      arrangeCompleted = true;
      needsWrite = true;
      hasChanges = true;
      continue;
    }

    const id = Number(taskId);
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) continue;

    if (prog.status === 'done') {
      tasks[idx] = {
        ...tasks[idx],
        status: 'done',
        completedAt: prog.completedAt || new Date().toISOString(),
        commitRef: prog.commitRef || tasks[idx].commitRef || undefined,
        branch: prog.branch || tasks[idx].branch || undefined,
        progress: undefined,
      };
      queue = queue.filter(q => q.task !== id);
      const actEntry: Activity = {
        id: 'act_' + Date.now() + '_' + id,
        time: Date.now(),
        label: (tasks[idx].name || 'Task ' + id) + ' completed',
        taskId: id,
      };
      if (prog.commitRef) actEntry.commitRef = prog.commitRef;
      if (prog.filesChanged) actEntry.filesChanged = prog.filesChanged;
      activity.unshift(actEntry);
      completedTaskIds.push(id);
      needsWrite = true;
    } else {
      const enriched: Partial<Task> = {
        status: prog.status || tasks[idx].status,
        progress: prog.progress || tasks[idx].progress,
      };
      if (prog.status === 'in-progress' && !tasks[idx].startedAt) {
        enriched.startedAt = new Date().toISOString();
        needsWrite = true;
      }
      tasks[idx] = { ...tasks[idx], ...enriched } as Task;
      hasChanges = true;
    }
  }

  return {
    data: { ...stateData, tasks, activity: activity.slice(0, 20), queue },
    needsWrite,
    hasChanges: hasChanges || needsWrite,
    completedTaskIds,
    arrangeCompleted,
  };
}

interface ProjectInfo {
  path: string;
  name: string;
  active: boolean;
}

export function useProject(opts?: { onError?: (msg: string) => void }) {
  const onError = opts?.onError;
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [projectName, setProjectName] = useState('');
  const [data, setData] = useState<StateData | null>(null);
  const [skillsConfig, setSkillsConfig] = useState<SkillsConfig | null>(null);
  const [availableSkills, setAvailableSkills] = useState<SkillInfo[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteTime = useRef(0);
  const dataRef = useRef<StateData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => { dataRef.current = data; }, [data]);

  const connectToServer = useCallback(async () => {
    setStatus('connecting');
    try {
      // Get project info from server
      const info = await api.getInfo();
      setProjectName(info.projectName);

      // Read initial state
      const existing = await readState();
      let stateData: StateData;
      if (existing) {
        stateData = existing.data;
        lastWriteTime.current = existing.lastModified;
      } else {
        // New project — show template picker
        setShowTemplatePicker(true);
        setStatus('template-picker');
        return;
      }

      const resolvedName = stateData.project || info.projectName;
      setProjectName(resolvedName);

      // Sync skills
      await syncSkills();

      // Discover skills
      const discovered = await discoverSkillsAndAgents();
      setAvailableSkills(discovered);
      const sc = await readSkillsConfig();
      setSkillsConfig(sc);

      // Fetch projects list
      try {
        const proj = await api.listProjects();
        setProjects(proj);
      } catch { /* server might not support multi-project yet */ }

      setData(stateData);
      setConnected(true);
      setStatus('connected');
    } catch (err) {
      console.error('Connection failed:', err);
      setStatus('error');
    }
  }, []);

  // WebSocket effect for real-time updates
  useEffect(() => {
    if (!connected) return;

    const setupWs = () => {
      const ws = connectWebSocket((msg) => {
        if (msg.type === 'state') {
          if (msg.lastModified > lastWriteTime.current + 1000) {
            setData(msg.data);
            lastWriteTime.current = msg.lastModified;
            if (msg.data.project) setProjectName(msg.data.project);
            setStatus('synced');
            setTimeout(() => setStatus('connected'), 2000);
          }
        }
        if (msg.type === 'progress') {
          setData(prev => {
            if (!prev) return prev;
            const mergeResult = mergeProgressIntoState(prev, msg.data);
            if (mergeResult.hasChanges) {
              if (mergeResult.needsWrite) {
                mergeResult.data.savedAt = new Date().toISOString();
                writeState(mergeResult.data).then(() => {
                  lastWriteTime.current = Date.now();
                });
                // Clean up completed tasks' progress files
                for (const id of mergeResult.completedTaskIds) {
                  deleteProgressFile(id);
                }
                if (mergeResult.arrangeCompleted) {
                  deleteProgressFile('arrange');
                }
              }
              return mergeResult.data;
            }
            return prev;
          });
        }
        if (msg.type === 'quality') {
          // Quality updates are handled by useQuality hook
        }
        if (msg.type === 'project-switched') {
          // Server switched to a different project — reconnect
          connectToServer();
        }
      }, () => {
        // On WebSocket close — attempt reconnect after 3 seconds
        setTimeout(() => {
          if (wsRef.current === ws) {
            wsRef.current = setupWs();
          }
        }, 3000);
      });
      return ws;
    };

    wsRef.current = setupWs();

    return () => {
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) ws.close();
    };
  }, [connected]);

  // Auto-connect on mount, retry once on failure
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    connectToServer().catch(() => {
      retryTimer = setTimeout(connectToServer, 2000);
    });
    return () => { if (retryTimer) clearTimeout(retryTimer); };
  }, [connectToServer]);

  const connect = useCallback(async () => {
    await connectToServer();
  }, [connectToServer]);

  const disconnect = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (dataRef.current) {
        await writeState(dataRef.current);
      }
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setData(null);
    setProjectName('');
    setStatus('disconnected');
  }, []);

  const save = useCallback((newData: StateData) => {
    const updated = { ...newData, savedAt: new Date().toISOString() };
    setData(updated);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await writeState(updated);
      if (ok) lastWriteTime.current = Date.now();
      setStatus(ok ? 'connected' : 'error');
    }, 500);
  }, []);

  const pauseTask = useCallback(async (taskId: number) => {
    const progressEntries = await readProgressFiles();
    const prog = progressEntries[taskId];

    await deleteProgressFile(taskId);

    setData(prev => {
      if (!prev) return prev;
      const tasks = (prev.tasks || []).map(t => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          status: 'paused' as const,
          progress: undefined,
          lastProgress: prog?.progress || t.progress || undefined,
          branch: t.branch || ('task-' + taskId),
        };
      });
      const updated = { ...prev, tasks, savedAt: new Date().toISOString() };
      writeState(updated).then(ok => {
        if (ok) lastWriteTime.current = Date.now();
      });
      return updated;
    });
  }, []);

  const saveSkills = useCallback(async (config: SkillsConfig) => {
    setSkillsConfig(config);
    await writeSkillsConfig(config);
  }, []);

  const cancelTask = useCallback(async (taskId: number) => {
    await deleteProgressFile(taskId);
    setData(prev => {
      if (!prev) return prev;
      const tasks = (prev.tasks || []).map(t =>
        t.id === taskId ? { ...t, status: 'pending' as const, progress: undefined, lastProgress: undefined, branch: undefined } : t
      );
      const updated = { ...prev, tasks, savedAt: new Date().toISOString() };
      writeState(updated).then(ok => {
        if (ok) lastWriteTime.current = Date.now();
      });
      return updated;
    });
  }, []);

  const switchProject = useCallback(async (path: string) => {
    setConnected(false);
    setData(null);
    setStatus('connecting');
    try {
      await api.switchProject(path);
      await connectToServer();
    } catch (err: any) {
      console.error('Switch project failed:', err);
      onError?.(`Failed to open project: ${err?.message || 'unknown error'}`);
      // Try reconnecting to the previous project
      try { await connectToServer(); } catch { setStatus('error'); }
    }
  }, [connectToServer, onError]);

  const connectWithTemplate = useCallback(async (template: ProjectTemplate | null) => {
    setStatus('connecting');
    setShowTemplatePicker(false);
    try {
      const info = await api.getInfo();
      let stateData: StateData;
      if (template) {
        stateData = await applyTemplate(info.projectName, template);
      } else {
        stateData = createDefaultState(info.projectName);
      }
      await writeState(stateData);
      lastWriteTime.current = Date.now();

      setProjectName(stateData.project || info.projectName);
      await syncSkills();
      const discovered = await discoverSkillsAndAgents();
      setAvailableSkills(discovered);
      const sc = await readSkillsConfig();
      setSkillsConfig(sc);
      try {
        const proj = await api.listProjects();
        setProjects(proj);
      } catch { /* ignore */ }

      setData(stateData);
      setConnected(true);
      setStatus('connected');
    } catch (err) {
      console.error('Template setup failed:', err);
      setStatus('error');
    }
  }, []);

  const cancelTemplatePicker = useCallback(() => {
    setShowTemplatePicker(false);
    setStatus('disconnected');
  }, []);

  return { connected, status, projectName, data, save, connect, disconnect, pauseTask, cancelTask, skillsConfig, saveSkills, availableSkills, projects, switchProject, showTemplatePicker, connectWithTemplate, cancelTemplatePicker };
}
