import { useState, useCallback, useRef, useEffect } from 'react';
import {
  loadDirHandle,
  saveDirHandle,
  clearDirHandle,
  verifyHandle,
  requestAccess,
  readState,
  writeState,
  createDefaultState,
  ensureOrchestratorSkill,
  readProgressFiles,
  deleteProgressFile,
} from '../fs.js';

export function useProject() {
  const [dirHandle, setDirHandle] = useState(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected | synced | error
  const [projectName, setProjectName] = useState('');
  const [data, setData] = useState(null);
  const [lastProjectName, setLastProjectName] = useState(() => {
    try { return localStorage.getItem('dm_last_project') || ''; } catch { return ''; }
  });

  const saveTimer = useRef(null);
  const lastWriteTime = useRef(0);
  const pollTimer = useRef(null);
  const dataRef = useRef(null);

  // Keep dataRef in sync
  useEffect(() => { dataRef.current = data; }, [data]);

  const connectWithHandle = useCallback(async (handle) => {
    setStatus('connecting');
    const name = handle.name;
    setProjectName(name);
    setLastProjectName(name);
    try { localStorage.setItem('dm_last_project', name); } catch {}

    // Try reading existing state
    const existing = await readState(handle);
    let stateData;
    if (existing) {
      stateData = existing.data;
      lastWriteTime.current = existing.lastModified;
    } else {
      // Create fresh state
      stateData = createDefaultState(name);
      await writeState(handle, stateData);
      lastWriteTime.current = Date.now();
    }

    // Use project name from state if available
    if (stateData.project) setProjectName(stateData.project);

    // Ensure orchestrator skill exists in the project
    await ensureOrchestratorSkill(handle);

    await saveDirHandle(handle);
    setDirHandle(handle);
    setData(stateData);
    setConnected(true);
    setStatus('connected');
  }, []);

  // On mount: try to restore saved handle (but don't auto-connect -- need user gesture for permission)
  useEffect(() => {
    (async () => {
      const handle = await loadDirHandle();
      if (handle && await verifyHandle(handle)) {
        // Permission already granted, auto-connect
        await connectWithHandle(handle);
      }
    })();
  }, [connectWithHandle]);

  const connect = useCallback(async () => {
    setStatus('connecting');

    // Try restoring saved handle first
    let handle = await loadDirHandle();
    if (handle) {
      if (await verifyHandle(handle) || await requestAccess(handle)) {
        await connectWithHandle(handle);
        return;
      }
    }

    // Pick new directory
    if (!window.showDirectoryPicker) {
      setStatus('error');
      return;
    }
    try {
      handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await connectWithHandle(handle);
    } catch (e) {
      if (e.name !== 'AbortError') setStatus('error');
      else setStatus('disconnected');
    }
  }, [connectWithHandle]);

  const reconnect = useCallback(async () => {
    const handle = await loadDirHandle();
    if (handle) {
      if (await requestAccess(handle)) {
        await connectWithHandle(handle);
        return;
      }
    }
    // If handle doesn't work, fall back to picker
    await connect();
  }, [connect, connectWithHandle]);

  const disconnect = useCallback(() => {
    clearTimeout(saveTimer.current);
    clearInterval(pollTimer.current);
    setDirHandle(null);
    setConnected(false);
    setData(null);
    setProjectName('');
    setStatus('disconnected');
    clearDirHandle();
  }, []);

  // Save function (debounced)
  const save = useCallback((newData) => {
    const updated = { ...newData, savedAt: new Date().toISOString() };
    setData(updated);
    if (!dirHandle) return;

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await writeState(dirHandle, updated);
      if (ok) lastWriteTime.current = Date.now();
      setStatus(ok ? 'connected' : 'error');
    }, 500);
  }, [dirHandle]);

  // Poll for external changes (every 3s) + merge per-task progress files
  useEffect(() => {
    if (!connected || !dirHandle) return;
    pollTimer.current = setInterval(async () => {
      const result = await readState(dirHandle);
      if (!result) return;

      let stateData = result.data;
      let stateChanged = false;

      // If file was modified after our last write, it's an external change
      if (result.lastModified > lastWriteTime.current + 1000) {
        lastWriteTime.current = result.lastModified;
        stateChanged = true;
      }

      // Read per-task progress files (always, regardless of state.json changes)
      const progressEntries = await readProgressFiles(dirHandle);
      let needsWrite = false;

      if (Object.keys(progressEntries).length > 0) {
        const tasks = [...(stateData.tasks || [])];
        const activity = [...(stateData.activity || [])];
        let queue = [...(stateData.queue || [])];

        for (const [taskId, prog] of Object.entries(progressEntries)) {
          // Handle arrange completion (non-task progress file)
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
            // Merge completion into state
            tasks[idx] = {
              ...tasks[idx],
              status: 'done',
              completedAt: prog.completedAt || new Date().toISOString(),
              commitRef: prog.commitRef || tasks[idx].commitRef || undefined,
              branch: prog.branch || tasks[idx].branch || undefined,
              progress: undefined,
            };
            // Remove from queue
            queue = queue.filter(q => q.task !== id);
            // Add activity entry
            const actEntry = {
              id: 'act_' + Date.now() + '_' + id,
              time: Date.now(),
              label: (tasks[idx].name || 'Task ' + id) + ' completed',
            };
            if (prog.commitRef) actEntry.commitRef = prog.commitRef;
            if (prog.filesChanged) actEntry.filesChanged = prog.filesChanged;
            activity.unshift(actEntry);
            // Delete the progress file + notes file + launch script (cleanup)
            await deleteProgressFile(dirHandle, id);
            try {
              const dmDir = await dirHandle.getDirectoryHandle('.devmanager');
              const notesDir = await dmDir.getDirectoryHandle('notes').catch(() => null);
              if (notesDir) await notesDir.removeEntry(id + '.md').catch(() => {});
              await dmDir.removeEntry('launch-' + id + '.cmd').catch(() => {});
            } catch {}
            needsWrite = true;
          } else {
            // In-progress: overlay in memory only (transient)
            const enriched = {
              status: prog.status || tasks[idx].status,
              progress: prog.progress || tasks[idx].progress,
            };
            if (prog.status === 'in-progress' && !tasks[idx].startedAt) {
              enriched.startedAt = new Date().toISOString();
              needsWrite = true;
            }
            tasks[idx] = { ...tasks[idx], ...enriched };
            stateChanged = true;
          }
        }

        stateData = { ...stateData, tasks, activity: activity.slice(0, 20), queue };
      }

      // If any "done" progress files were merged, persist to state.json
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
      }
    }, 3000);
    return () => clearInterval(pollTimer.current);
  }, [connected, dirHandle]);

  // Pause a running task: save branch/progress info, delete progress file, set status to paused
  const pauseTask = useCallback(async (taskId) => {
    if (!dirHandle) return;
    // Read the progress file first to capture current state
    const progressEntries = await readProgressFiles(dirHandle);
    const prog = progressEntries[taskId];

    await deleteProgressFile(dirHandle, taskId);

    // Update state: save branch + last progress, set status to paused
    setData(prev => {
      if (!prev) return prev;
      const tasks = (prev.tasks || []).map(t => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          status: 'paused',
          progress: undefined,
          lastProgress: prog?.progress || t.progress || null,
          branch: t.branch || ('task-' + taskId),
        };
      });
      const updated = { ...prev, tasks, savedAt: new Date().toISOString() };
      // Persist immediately
      writeState(dirHandle, updated).then(ok => {
        if (ok) lastWriteTime.current = Date.now();
      });
      return updated;
    });
  }, [dirHandle]);

  // Cancel a running task: delete progress file, reset to pending (discard progress)
  const cancelTask = useCallback(async (taskId) => {
    if (!dirHandle) return;
    await deleteProgressFile(dirHandle, taskId);
    setData(prev => {
      if (!prev) return prev;
      const tasks = (prev.tasks || []).map(t =>
        t.id === taskId ? { ...t, status: 'pending', progress: undefined, lastProgress: undefined, branch: undefined } : t
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
