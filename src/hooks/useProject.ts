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

export function useProject() {
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

    const existing = await readState(handle);
    let stateData: StateData;
    if (existing) {
      stateData = existing.data;
      lastWriteTime.current = existing.lastModified;
    } else {
      stateData = createDefaultState(name);
      await writeState(handle, stateData);
      lastWriteTime.current = Date.now();
    }

    const resolvedName = stateData.project || name;
    setProjectName(resolvedName);

    try { sessionStorage.setItem('dm_tab_project', resolvedName); } catch (err) { console.error('Failed to write dm_tab_project to sessionStorage:', err); }

    await ensureOrchestratorSkill(handle);
    await ensureCodehealthSkill(handle);
    await ensureAutofixSkill(handle);

    await saveDirHandle(handle, resolvedName);
    setDirHandle(handle);
    setData(stateData);
    setConnected(true);
    setStatus('connected');
  }, [flushSave]);

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

    if (!(window as any).showDirectoryPicker) {
      setStatus('error');
      return;
    }
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      await connectWithHandle(handle);
    } catch (e: any) {
      if (e.name !== 'AbortError') setStatus('error');
      else setStatus('disconnected');
    }
  }, [connectWithHandle]);

  const reconnect = useCallback(async () => {
    const targetName = lastProjectName || null;
    const handle = await loadDirHandle(targetName);
    if (handle) {
      if (await requestAccess(handle)) {
        await connectWithHandle(handle);
        return;
      }
    }
    await connect();
  }, [connect, connectWithHandle, lastProjectName]);

  const disconnect = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (dirHandle && dataRef.current) {
        await writeState(dirHandle, dataRef.current);
      }
    }
    if (pollTimer.current) clearInterval(pollTimer.current);
    setDirHandle(null);
    setConnected(false);
    setData(null);
    setProjectName('');
    setStatus('disconnected');
  }, [dirHandle]);

  const save = useCallback((newData: StateData) => {
    const updated = { ...newData, savedAt: new Date().toISOString() };
    setData(updated);
    if (!dirHandle) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await writeState(dirHandle, updated);
      if (ok) lastWriteTime.current = Date.now();
      setStatus(ok ? 'connected' : 'error');
    }, 500);
  }, [dirHandle]);

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

      const progressEntries = await readProgressFiles(dirHandle);
      let needsWrite = false;

      if (Object.keys(progressEntries).length > 0) {
        const tasks: Task[] = [...(stateData.tasks || [])];
        const activity: Activity[] = [...(stateData.activity || [])];
        let queue = [...(stateData.queue || [])];

        for (const [taskId, prog] of Object.entries(progressEntries)) {
          if (taskId === 'arrange' && prog.status === 'done') {
            activity.unshift({
              id: 'act_' + Date.now() + '_arrange',
              time: Date.now(),
              label: prog.label || 'Tasks arranged into dependency graph',
            });
            await deleteProgressFile(dirHandle, 'arrange');
            needsWrite = true;
            stateChanged = true;
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
            await deleteProgressFile(dirHandle, id);
            try {
              const dmDir = await dirHandle.getDirectoryHandle('.devmanager');
              const notesDir = await dmDir.getDirectoryHandle('notes').catch(() => null);
              if (notesDir) await notesDir.removeEntry(id + '.md').catch(() => {});
              await dmDir.removeEntry('launch-' + id + '.cmd').catch(() => {});
            } catch (err) { console.error('Failed to clean up after task completion:', err); }
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
            stateChanged = true;
          }
        }

        stateData = { ...stateData, tasks, activity: activity.slice(0, 20), queue };
      }

      if (needsWrite) {
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
    const progressEntries = await readProgressFiles(dirHandle);
    const prog = progressEntries[taskId];

    await deleteProgressFile(dirHandle, taskId);

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
      writeState(dirHandle, updated).then(ok => {
        if (ok) lastWriteTime.current = Date.now();
      });
      return updated;
    });
  }, [dirHandle]);

  const cancelTask = useCallback(async (taskId: number) => {
    if (!dirHandle) return;
    await deleteProgressFile(dirHandle, taskId);
    setData(prev => {
      if (!prev) return prev;
      const tasks = (prev.tasks || []).map(t =>
        t.id === taskId ? { ...t, status: 'pending' as const, progress: undefined, lastProgress: undefined, branch: undefined } : t
      );
      const updated = { ...prev, tasks, savedAt: new Date().toISOString() };
      writeState(dirHandle, updated).then(ok => {
        if (ok) lastWriteTime.current = Date.now();
      });
      return updated;
    });
  }, [dirHandle]);

  return { connected, status, projectName, data, save, connect, reconnect, disconnect, lastProjectName, dirHandle, pauseTask, cancelTask };
}
