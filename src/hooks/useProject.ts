import { useState, useCallback, useRef, useEffect } from 'react';
import type { StateData, Activity, Task } from '../types';
import {
  loadDirHandle,
  saveDirHandle,
  verifyHandle,
  requestAccess,
  readState,
  writeState,
  createDefaultState,
  ensureOrchestratorSkill,
  ensureCodehealthSkill,
  ensureAutofixSkill,
  readProgressFiles,
  deleteProgressFile,
  syncSkills,
} from '../fs.ts';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'synced' | 'error';

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

export function useProject(opts?: { onError?: (msg: string) => void }) {
  const onError = opts?.onError;
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [projectName, setProjectName] = useState('');
  const [data, setData] = useState<StateData | null>(null);
  const [lastProjectName, setLastProjectName] = useState(() => {
    try { return localStorage.getItem('dm_last_project') || ''; } catch (err) { console.error('Failed to read dm_last_project from localStorage:', err); return ''; }
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteTime = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef = useRef<StateData | null>(null);

  useEffect(() => { dataRef.current = data; }, [data]);

  const flushSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, []);

  const connectWithHandle = useCallback(async (handle: FileSystemDirectoryHandle) => {
    await flushSave();

    setStatus('connecting');
    const name = handle.name;
    setProjectName(name);
    setLastProjectName(name);
    try { localStorage.setItem('dm_last_project', name); } catch (err) { console.error('Failed to write dm_last_project to localStorage:', err); }

    const existing = await readState(handle, onError);
    let stateData: StateData;
    if (existing) {
      stateData = existing.data;
      lastWriteTime.current = existing.lastModified;
    } else {
      stateData = createDefaultState(name);
      await writeState(handle, stateData, onError);
      lastWriteTime.current = Date.now();
    }

    const resolvedName = stateData.project || name;
    setProjectName(resolvedName);

    try { sessionStorage.setItem('dm_tab_project', resolvedName); } catch (err) { console.error('Failed to write dm_tab_project to sessionStorage:', err); }

    await ensureOrchestratorSkill(handle, onError);
    await ensureCodehealthSkill(handle, onError);
    await ensureAutofixSkill(handle, onError);

    await saveDirHandle(handle, resolvedName);
    setDirHandle(handle);
    setData(stateData);
    setConnected(true);
    setStatus('connected');
  }, [flushSave, onError]);

  useEffect(() => {
    (async () => {
      const tabProject = sessionStorage.getItem('dm_tab_project') || null;
      const handle = await loadDirHandle(tabProject);
      if (handle && await verifyHandle(handle)) {
        await connectWithHandle(handle);
      }
    })();
  }, [connectWithHandle]);

  const connect = useCallback(async () => {
    setStatus('connecting');

    if (!window.showDirectoryPicker) {
      setStatus('error');
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await connectWithHandle(handle);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') setStatus('disconnected');
      else setStatus('error');
    }
  }, [connectWithHandle]);

  const reconnect = useCallback(async () => {
    const targetName = lastProjectName || null;
    const handle = await loadDirHandle(targetName);
    if (handle) {
      if (await requestAccess(handle, onError)) {
        await connectWithHandle(handle);
        return;
      }
    }
    await connect();
  }, [connect, connectWithHandle, lastProjectName, onError]);

  const disconnect = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (dirHandle && dataRef.current) {
        await writeState(dirHandle, dataRef.current, onError);
      }
    }
    if (pollTimer.current) clearInterval(pollTimer.current);
    setDirHandle(null);
    setConnected(false);
    setData(null);
    setProjectName('');
    setStatus('disconnected');
  }, [dirHandle, onError]);

  const save = useCallback((newData: StateData) => {
    const updated = { ...newData, savedAt: new Date().toISOString() };
    setData(updated);
    if (!dirHandle) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await writeState(dirHandle, updated, onError);
      if (ok) lastWriteTime.current = Date.now();
      setStatus(ok ? 'connected' : 'error');
    }, 500);
  }, [dirHandle, onError]);

  useEffect(() => {
    if (!connected || !dirHandle) return;
    pollTimer.current = setInterval(async () => {
      const result = await readState(dirHandle);
      if (!result) return;

      let stateData = result.data;
      let stateChanged = false;

      if (result.lastModified > lastWriteTime.current + 1000) {
        lastWriteTime.current = result.lastModified;
        stateChanged = true;
      }

      const progressEntries = await readProgressFiles(dirHandle, onError);
      const mergeResult = mergeProgressIntoState(stateData, progressEntries);
      stateData = mergeResult.data;
      if (mergeResult.hasChanges) stateChanged = true;

      // Clean up progress files for completed tasks and arrange
      if (mergeResult.arrangeCompleted) {
        await deleteProgressFile(dirHandle, 'arrange', onError);
      }
      for (const id of mergeResult.completedTaskIds) {
        await deleteProgressFile(dirHandle, id, onError);
        try {
          const dmDir = await dirHandle.getDirectoryHandle('.devmanager');
          const notesDir = await dmDir.getDirectoryHandle('notes').catch(() => null);
          if (notesDir) await notesDir.removeEntry(id + '.md').catch(e => console.warn('Failed to remove notes file for task ' + id + ':', e));
          await dmDir.removeEntry('launch-' + id + '.cmd').catch(e => console.warn('Failed to remove launch file for task ' + id + ':', e));
        } catch (err) { console.error('Failed to clean up after task completion:', err); }
      }

      if (mergeResult.needsWrite) {
        stateData.savedAt = new Date().toISOString();
        const ok = await writeState(dirHandle, stateData);
        if (ok) lastWriteTime.current = Date.now();
        stateChanged = true;
      }

      if (stateChanged) {
        setData(stateData);
        if (stateData.project) setProjectName(stateData.project);
        setStatus('synced');
        setTimeout(() => setStatus('connected'), 2000);
      } else {
        setStatus(prev => prev === 'error' ? 'connected' : prev);
      }

      await syncSkills(dirHandle);
    }, 3000);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [connected, dirHandle]);

  const pauseTask = useCallback(async (taskId: number) => {
    if (!dirHandle) return;
    const progressEntries = await readProgressFiles(dirHandle, onError);
    const prog = progressEntries[taskId];

    await deleteProgressFile(dirHandle, taskId, onError);

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
      writeState(dirHandle, updated, onError).then(ok => {
        if (ok) lastWriteTime.current = Date.now();
      });
      return updated;
    });
  }, [dirHandle, onError]);

  const cancelTask = useCallback(async (taskId: number) => {
    if (!dirHandle) return;
    await deleteProgressFile(dirHandle, taskId, onError);
    setData(prev => {
      if (!prev) return prev;
      const tasks = (prev.tasks || []).map(t =>
        t.id === taskId ? { ...t, status: 'pending' as const, progress: undefined, lastProgress: undefined, branch: undefined } : t
      );
      const updated = { ...prev, tasks, savedAt: new Date().toISOString() };
      writeState(dirHandle, updated, onError).then(ok => {
        if (ok) lastWriteTime.current = Date.now();
      });
      return updated;
    });
  }, [dirHandle, onError]);

  return { connected, status, projectName, data, save, connect, reconnect, disconnect, lastProjectName, dirHandle, pauseTask, cancelTask };
}
