import { useState, useCallback, useRef, useEffect } from 'react';
import type { StateData, Activity, Task, WebSocketMessage } from '../types';
import {
  writeState,
  readProgressFiles,
  deleteProgressFile,
} from '../fs.ts';
import { validateProgress } from '../validate.ts';
import type { ConnectionStatus } from './useConnection.ts';

export interface MergeResult {
  data: StateData;
  needsWrite: boolean;
  hasChanges: boolean;
  completedTaskIds: number[];
  arrangeCompleted: boolean;
  staleProgressIds: (string | number)[];
}

export function mergeProgressIntoState(
  stateData: StateData,
  progressEntries: Record<string | number, import('../types').ProgressEntry>,
): MergeResult {
  if (Object.keys(progressEntries).length === 0) {
    return { data: stateData, needsWrite: false, hasChanges: false, completedTaskIds: [], arrangeCompleted: false, staleProgressIds: [] };
  }

  const tasks: Task[] = [...(stateData.tasks || [])];
  const activity: Activity[] = [...(stateData.activity || [])];
  let queue = [...(stateData.queue || [])];
  let needsWrite = false;
  let hasChanges = false;
  const completedTaskIds: number[] = [];
  const staleProgressIds: (string | number)[] = [];
  let arrangeCompleted = false;

  for (const [taskId, rawProg] of Object.entries(progressEntries)) {
    // Special case: arrange has its own shape (taskUpdates, changes, label)
    if (taskId === 'arrange') {
      if (rawProg.status === 'done') {
        const arrangeActivity: Activity = {
          id: 'act_' + Date.now() + '_arrange',
          time: Date.now(),
          label: rawProg.label || 'Tasks arranged into dependency graph',
        };
        if (rawProg.changes) arrangeActivity.changes = rawProg.changes;
        activity.unshift(arrangeActivity);
        // Apply task updates from arrange (dependsOn, group changes)
        if (rawProg.taskUpdates) {
          for (const [tid, updates] of Object.entries(rawProg.taskUpdates)) {
            const tIdx = tasks.findIndex(t => t.id === Number(tid));
            if (tIdx !== -1) {
              tasks[tIdx] = { ...tasks[tIdx], ...updates } as Task;
            }
          }
        }
        arrangeCompleted = true;
        needsWrite = true;
        hasChanges = true;
      }
      continue;
    }

    // Validate progress entry at the boundary
    const prog = validateProgress(rawProg);
    if (!prog) {
      staleProgressIds.push(taskId);
      console.warn(`[sync] Invalid progress entry for task ${taskId} — skipping`);
      continue;
    }

    const id = Number(taskId);
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) {
      staleProgressIds.push(id);
      console.warn(`[sync] Progress entry references unknown task ID: ${id}`);
      continue;
    }

    if (prog.status === 'done') {
      tasks[idx] = {
        ...tasks[idx],
        status: 'done',
        completedAt: prog.completedAt || new Date().toISOString(),
        commitRef: prog.commitRef || tasks[idx].commitRef || undefined,
        branch: prog.branch || tasks[idx].branch || undefined,
        summary: prog.summary || tasks[idx].summary || undefined,
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
      if (prog.summary) actEntry.changes = [prog.summary];
      activity.unshift(actEntry);
      completedTaskIds.push(id);
      needsWrite = true;
    } else {
      // Skip stale progress for tasks already marked done
      if (tasks[idx].status === 'done') {
        staleProgressIds.push(id);
        continue;
      }
      const enriched: Partial<Task> = {
        status: prog.status || tasks[idx].status,
        progress: prog.progress || tasks[idx].progress,
      };
      if (prog.status === 'in-progress') {
        if (!tasks[idx].startedAt) {
          enriched.startedAt = new Date().toISOString();
        }
      }
      tasks[idx] = { ...tasks[idx], ...enriched } as Task;
      hasChanges = true;
    }
  }

  const truncatedActivity = activity.slice(0, 20);
  if (activity.length > 20) {
    console.warn(`[sync] Activity log truncated: ${activity.length} entries → 20 (${activity.length - 20} dropped)`);
  }

  return {
    data: { ...stateData, tasks, activity: truncatedActivity, queue },
    needsWrite,
    hasChanges: hasChanges || needsWrite,
    completedTaskIds,
    arrangeCompleted,
    staleProgressIds,
  };
}

interface UseSyncOptions {
  setStatus: (status: ConnectionStatus) => void;
  onError?: (msg: string) => void;
}

export function useSync({ setStatus, onError }: UseSyncOptions) {
  const [data, setData] = useState<StateData | null>(null);
  const [projectName, setProjectName] = useState('');

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteTimeRef = useRef(0);
  const dataRef = useRef<StateData | null>(null);

  useEffect(() => { dataRef.current = data; }, [data]);

  const save = useCallback((newData: StateData) => {
    const updated = { ...newData, savedAt: new Date().toISOString() };
    setData(updated);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const result = await writeState(updated, lastWriteTimeRef.current);
      if (result.conflict && result.data) {
        // File on disk is newer — but only adopt if version isn't stale
        const currentV = dataRef.current?._v || 0;
        const conflictV = result.data._v || 0;
        if (currentV > 0 && conflictV < currentV) {
          // Conflict state is stale (rogue write) — retry our write
          console.warn(`[sync] Conflict state is stale: _v=${conflictV} < current _v=${currentV}, retrying`);
          const retryResult = await writeState(updated);
          if (retryResult.ok && retryResult.lastModified) {
            lastWriteTimeRef.current = retryResult.lastModified;
          }
          setStatus('connected');
        } else {
          setData(result.data);
          lastWriteTimeRef.current = result.lastModified!;
          setStatus('synced');
          setTimeout(() => setStatus('connected'), 2000);
        }
      } else if (result.ok) {
        if (result.lastModified) lastWriteTimeRef.current = result.lastModified;
        setStatus('connected');
      } else {
        onError?.('Save failed — changes may not be persisted');
        setStatus('error');
      }
    }, 500);
  }, [setStatus, onError]);

  // Returns true if the message was handled as a sync message
  const handleSyncMessage = useCallback((msg: WebSocketMessage): boolean => {
    if (msg.type === 'state') {
      if (msg.lastModified > lastWriteTimeRef.current + 1000) {
        // Regression guard: reject incoming state with a stale version counter
        const currentData = dataRef.current;
        const incomingV = msg.data._v || 0;
        const currentV = currentData?._v || 0;
        if (currentV > 0 && incomingV < currentV) {
          console.warn(`[sync] Rejected stale state: incoming _v=${incomingV} < current _v=${currentV}`);
          return true;
        }
        // Protect done tasks from regression by external state writes
        // (e.g., orchestrator writing stale state after UI merged "done" from progress files)
        if (currentData) {
          const doneTasks = new Map(
            currentData.tasks.filter(t => t.status === 'done' && t.completedAt).map(t => [t.id, t])
          );
          if (doneTasks.size > 0) {
            let patched = false;
            for (const task of msg.data.tasks) {
              if (task.status !== 'done' && doneTasks.has(task.id)) {
                const doneTask = doneTasks.get(task.id)!;
                task.status = 'done';
                task.completedAt = doneTask.completedAt;
                if (doneTask.commitRef) task.commitRef = doneTask.commitRef;
                if (doneTask.summary) task.summary = doneTask.summary;
                task.progress = undefined;
                patched = true;
              }
            }
            if (patched) {
              msg.data.queue = (msg.data.queue || []).filter(
                q => !doneTasks.has(q.task)
              );
              console.warn('[sync] Prevented done-task regression from external state write');
            }
          }
        }
        setData(msg.data);
        lastWriteTimeRef.current = msg.lastModified;
        if (msg.data.project) setProjectName(msg.data.project);
        setStatus('synced');
        setTimeout(() => setStatus('connected'), 2000);
      }
      return true;
    }
    if (msg.type === 'progress') {
      setData(prev => {
        if (!prev) return prev;
        const mergeResult = mergeProgressIntoState(prev, msg.data);
        // Clean up stale progress files (tasks already done)
        for (const id of mergeResult.staleProgressIds) {
          deleteProgressFile(id).catch((err) => console.error('[sync] Failed to delete progress file:', err));
        }
        if (mergeResult.hasChanges) {
          if (mergeResult.needsWrite) {
            mergeResult.data.savedAt = new Date().toISOString();
            writeState(mergeResult.data).then((result) => {
              if (result.ok && result.lastModified) {
                lastWriteTimeRef.current = result.lastModified;
                // Only delete progress files AFTER state write succeeds
                // (prevents losing "done" status if write fails and file is gone)
                for (const id of mergeResult.completedTaskIds) {
                  deleteProgressFile(id).catch((err) => console.error('[sync] Failed to delete progress file:', err));
                }
                if (mergeResult.arrangeCompleted) {
                  deleteProgressFile('arrange').catch((err) => console.error('[sync] Failed to delete progress file:', err));
                }
              } else if (!result.ok) {
                console.error('[sync] Failed to write merged progress state — keeping progress files for retry');
                onError?.('Failed to sync task progress');
                setStatus('error');
              }
            }).catch((err) => {
              console.error('[sync] writeState error — keeping progress files for retry:', err);
              onError?.('Failed to sync task progress');
              setStatus('error');
            });
          }
          return mergeResult.data;
        }
        return prev;
      });
      return true;
    }
    return false;
  }, [setStatus, onError]);

  const pauseTask = useCallback(async (taskId: number) => {
    const progressEntries = await readProgressFiles();
    const prog = progressEntries[taskId];

    try {
      await deleteProgressFile(taskId);
    } catch (err) {
      console.error('[sync] Failed to delete progress file:', err);
    }

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
      writeState(updated).then((result) => {
        if (result.ok && result.lastModified) {
          lastWriteTimeRef.current = result.lastModified;
        } else if (!result.ok) {
          console.error('[sync] Failed to write paused task state');
          onError?.('Failed to save paused state');
          setStatus('error');
        }
      }).catch((err) => {
        console.error('[sync] writeState error:', err);
        onError?.('Failed to save paused state');
        setStatus('error');
      });
      return updated;
    });
  }, [setStatus, onError]);

  const cancelTask = useCallback(async (taskId: number) => {
    try {
      await deleteProgressFile(taskId);
    } catch (err) {
      console.error('[sync] Failed to delete progress file:', err);
    }
    setData(prev => {
      if (!prev) return prev;
      const tasks = (prev.tasks || []).map(t =>
        t.id === taskId ? { ...t, status: 'pending' as const, progress: undefined, lastProgress: undefined, branch: undefined } : t
      );
      const updated = { ...prev, tasks, savedAt: new Date().toISOString() };
      writeState(updated).then((result) => {
        if (result.ok && result.lastModified) {
          lastWriteTimeRef.current = result.lastModified;
        } else if (!result.ok) {
          console.error('[sync] Failed to write cancelled task state');
          onError?.('Failed to save cancelled state');
          setStatus('error');
        }
      }).catch((err) => {
        console.error('[sync] writeState error:', err);
        onError?.('Failed to save cancelled state');
        setStatus('error');
      });
      return updated;
    });
  }, [setStatus, onError]);

  const flushPendingSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (dataRef.current) {
        await writeState(dataRef.current);
      }
    }
  }, []);

  return {
    data, setData,
    projectName, setProjectName,
    save,
    handleSyncMessage,
    pauseTask,
    cancelTask,
    flushPendingSave,
    lastWriteTimeRef,
  };
}
