import { useRef, useEffect } from 'react';
import { api } from '../api.ts';
import { resolveModel } from '../constants/engines.ts';
import type { StateData, TaskStatus } from '../types';
import type { LaunchMode } from './useQueueActions.ts';

interface UseTaskLauncherParams {
  data: StateData | null;
  save: (data: StateData) => void;
  launchMode: LaunchMode;
  onError: (msg: string) => void;
}

export function useTaskLauncher({ data, save, launchMode, onError }: UseTaskLauncherParams) {
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const setTaskProgress = (taskId: number, progress: string | undefined, status: TaskStatus = 'in-progress') => {
    if (!data) return;
    const tasks = (data.tasks || []).map(t =>
      t.id === taskId ? { ...t, status, progress, startedAt: t.startedAt || new Date().toISOString() } : t
    );
    save({ ...data, tasks });
  };

  const resolveTaskModel = (taskId: number, cmd: string): string | undefined => {
    const d = dataRef.current;
    const task = (d?.tasks || []).find(t => t.id === taskId);
    return resolveModel(cmd, task?.model, d?.defaultModel, task);
  };

  const handleLaunchTask = async (itemKey: number, cmd: string, taskName: string) => {
    try {
      // Skip re-launching tasks that are already running
      const task = (dataRef.current?.tasks || []).find(t => t.id === itemKey);
      if (task?.status === 'in-progress') return;

      const model = resolveTaskModel(itemKey, cmd);
      if (launchMode === 'terminal') {
        await api.launchTerminal(itemKey, cmd, undefined, taskName, model);
      } else {
        setTaskProgress(itemKey, 'Launching...');
        await api.launch(itemKey, cmd, undefined, model);
      }
    } catch (err) {
      console.error('Failed to launch task:', err);
      setTaskProgress(itemKey, undefined, 'pending');
      onError(`Failed to launch task: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleLaunchTerminal = async (itemKey: number, cmd: string, taskName: string) => {
    try {
      const model = resolveTaskModel(itemKey, cmd);
      await api.launchTerminal(itemKey, cmd, undefined, taskName, model);
    } catch (err) {
      console.error('Failed to launch in terminal:', err);
      onError(`Failed to open terminal: ${err instanceof Error ? err.message : err}`);
    }
  };

  const waitForProcess = async (pid: number, timeout = 600000): Promise<boolean> => {
    const start = Date.now();
    let consecutiveFailures = 0;
    while (Date.now() - start < timeout) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const procs = await api.listProcesses();
        consecutiveFailures = 0;
        if (!procs.some(p => p.pid === pid)) return true;
      } catch (err) {
        consecutiveFailures++;
        console.warn('[queue] Process poll failed:', err);
        if (consecutiveFailures >= 5) return false;
      }
    }
    return false; // timed out
  };

  return {
    dataRef,
    setTaskProgress,
    handleLaunchTask,
    handleLaunchTerminal,
    waitForProcess,
  };
}
