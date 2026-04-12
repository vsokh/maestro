import { useState, useCallback, useRef, useEffect } from 'react';
import type { StateData, WebSocketMessage } from '../types';
import {
  mergeProgressIntoState,
  protectDoneTaskRegression,
  isStaleVersion,
} from 'taskgraph';
export type { MergeResult } from 'taskgraph';
import {
  writeState,
  readProgressFiles,
  deleteProgressFile,
} from '../fs.ts';
import type { ConnectionStatus } from './useConnection.ts';

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
        if (isStaleVersion(conflictV, currentV)) {
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
        onError?.('Save failed — changes may not be persisted. Check network connection');
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
        if (isStaleVersion(incomingV, currentV)) {
          console.warn(`[sync] Rejected stale state: incoming _v=${incomingV} < current _v=${currentV}`);
          return true;
        }
        // Protect done tasks from regression by external state writes
        if (currentData) {
          msg.data = protectDoneTaskRegression(currentData, msg.data);
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
                for (const id of mergeResult.completedTaskIds) {
                  deleteProgressFile(id).catch((err) => console.error('[sync] Failed to delete progress file:', err));
                }
                if (mergeResult.arrangeCompleted) {
                  deleteProgressFile('arrange').catch((err) => console.error('[sync] Failed to delete progress file:', err));
                }
              } else if (!result.ok) {
                console.error('[sync] Failed to write merged progress state — keeping progress files for retry');
                onError?.('Failed to sync task progress: server rejected write');
                setStatus('error');
              }
            }).catch((err) => {
              console.error('[sync] writeState error — keeping progress files for retry:', err);
              onError?.(`Failed to sync task progress: ${err instanceof Error ? err.message : err}`);
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
          onError?.('Failed to save paused state: server rejected write');
          setStatus('error');
        }
      }).catch((err) => {
        console.error('[sync] writeState error:', err);
        onError?.(`Failed to save paused state: ${err instanceof Error ? err.message : err}`);
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
          onError?.('Failed to save cancelled state: server rejected write');
          setStatus('error');
        }
      }).catch((err) => {
        console.error('[sync] writeState error:', err);
        onError?.(`Failed to save cancelled state: ${err instanceof Error ? err.message : err}`);
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
