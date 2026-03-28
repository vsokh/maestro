import { useState, useRef, useEffect } from 'react';
import { api } from '../api.ts';
import { sortByDependencies } from '../utils/sortByDependencies.ts';
import { computePhases } from '../utils/computePhases.ts';
import { createActivityList } from '../utils/activityUtils.ts';
import { getUnqueuedTasks } from '../utils/taskFilters.ts';
import type { StateData, Task, TaskStatus, QueueItem } from '../types';

interface UseQueueActionsParams {
  data: StateData | null;
  save: (data: StateData) => void;
  snapshotBeforeAction: (label: string) => void;
  onError: (msg: string) => void;
}

interface LaunchPhaseItem {
  key: number;
  cmd: string;
  taskName: string;
}

export type LaunchMode = 'background' | 'sequential' | 'terminal';

export function useQueueActions({ data, save, snapshotBeforeAction, onError }: UseQueueActionsParams) {
  const [launchedIds] = useState<Set<number>>(new Set());
  const [launchMode, setLaunchMode] = useState<LaunchMode>('background');

  // Keep a ref to latest data so async handlers can re-verify against fresh state
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const tasks: Task[] = data?.tasks || [];
  const queue: QueueItem[] = data?.queue || [];
  const taskNotes: Record<string, string> = data?.taskNotes || {};

  const updateData = (partial: Partial<StateData>) => {
    save({ ...data!, ...partial });
  };

  const addActivity = (label: string, taskId?: number) =>
    createActivityList(label, data?.activity || [], taskId);

  const handleQueue = (task: Task) => {
    if (queue.some(q => q.task === task.id)) return;
    const unsorted = [...queue, {
      task: task.id,
      taskName: task.name,
      notes: taskNotes[task.id] || '',
    }];
    const newQueue = sortByDependencies(unsorted, tasks);
    const newActivity = addActivity(task.name + ' queued', task.id);
    updateData({ queue: newQueue, activity: newActivity });
  };

  const handleQueueAll = () => {
    const pending = getUnqueuedTasks(tasks, queue);
    if (pending.length === 0) return;
    const unsorted = [...queue, ...pending.map(t => ({
      task: t.id,
      taskName: t.name,
      notes: taskNotes[t.id] || '',
    }))];
    const newQueue = sortByDependencies(unsorted, tasks);
    const newActivity = addActivity(pending.length + ' tasks queued');
    updateData({ queue: newQueue, activity: newActivity });
  };

  const handleQueueGroup = (groupName: string) => {
    const pending = getUnqueuedTasks(tasks.filter(t => t.group === groupName), queue);
    if (pending.length === 0) return;
    const unsorted = [...queue, ...pending.map(t => ({
      task: t.id,
      taskName: t.name,
      notes: taskNotes[t.id] || '',
    }))];
    const newQueue = sortByDependencies(unsorted, tasks);
    const newActivity = addActivity(pending.length + ' ' + groupName + ' tasks queued');
    updateData({ queue: newQueue, activity: newActivity });
  };

  const handleRemoveFromQueue = (key: number) => {
    const newQueue = queue.filter(q => q.task !== key);
    updateData({ queue: newQueue });
  };

  const handleClearQueue = () => {
    if (queue.length === 0) return;
    snapshotBeforeAction('Queue cleared');
    updateData({ queue: [] });
  };

  const setTaskProgress = (taskId: number, progress: string | undefined, status: TaskStatus = 'in-progress') => {
    if (!data) return;
    const tasks = (data.tasks || []).map(t =>
      t.id === taskId ? { ...t, status, progress, startedAt: t.startedAt || new Date().toISOString() } : t
    );
    save({ ...data, tasks });
  };

  const handleLaunchTask = async (itemKey: number, cmd: string, taskName: string) => {
    try {
      // Skip re-launching tasks that are already running
      const task = (dataRef.current?.tasks || []).find(t => t.id === itemKey);
      if (task?.status === 'in-progress') return;

      if (launchMode === 'terminal') {
        await api.launchTerminal(itemKey, cmd, undefined, taskName);
      } else {
        setTaskProgress(itemKey, 'Launching...');
        await api.launch(itemKey, cmd);
      }
    } catch (err) {
      console.error('Failed to launch task:', err);
      if (launchMode !== 'terminal') setTaskProgress(itemKey, undefined, 'pending');
      onError('Failed to launch task');
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

  const handleLaunchPhase = async (items: LaunchPhaseItem[], phaseIndex?: number) => {
    try {
      // Re-verify phase membership against latest data to prevent launching
      // tasks that moved to a different phase between render and click
      let verified = items;
      const fresh = dataRef.current;
      if (fresh && phaseIndex != null) {
        const phases = computePhases(fresh.queue || [], fresh.tasks || []);
        if (phases && phases[phaseIndex]) {
          const phaseTaskIds = new Set(phases[phaseIndex].map(q => q.task));
          verified = items.filter(i => phaseTaskIds.has(i.key));
        }
      }
      // Skip tasks already running
      const freshTasks = (dataRef.current?.tasks || []);
      const runningIds = new Set(freshTasks.filter(t => t.status === 'in-progress').map(t => t.id));
      verified = verified.filter(i => !runningIds.has(i.key));
      if (verified.length === 0) return;

      if (launchMode === 'sequential') {
        // Sequential: launch one at a time, wait for each to finish
        for (const item of verified) {
          const freshNow = dataRef.current;
          if (freshNow) {
            const tasks = (freshNow.tasks || []).map(t =>
              t.id === item.key ? { ...t, status: 'in-progress' as const, progress: 'Launching...', startedAt: t.startedAt || new Date().toISOString() } : t
            );
            save({ ...freshNow, tasks });
          }
          const { pid } = await api.launch(item.key, item.cmd);
          await waitForProcess(pid);
        }
      } else {
        // Parallel: batch-set all tasks to 'Launching...' then launch all
        if (fresh) {
          const launchingIds = new Set(verified.map(i => i.key));
          const tasks = (fresh.tasks || []).map(t =>
            launchingIds.has(t.id) ? { ...t, status: 'in-progress' as const, progress: 'Launching...', startedAt: t.startedAt || new Date().toISOString() } : t
          );
          save({ ...fresh, tasks });
        }
        for (const item of verified) {
          if (launchMode === 'terminal') {
            await api.launchTerminal(item.key, item.cmd, undefined, item.taskName);
          } else {
            await api.launch(item.key, item.cmd);
          }
        }
      }
    } catch (err) {
      console.error('Failed to launch phase:', err);
      onError('Failed to launch phase');
    }
  };

  const handleLaunchTerminal = async (itemKey: number, cmd: string, taskName: string) => {
    try {
      await api.launchTerminal(itemKey, cmd, undefined, taskName);
    } catch (err) {
      console.error('Failed to launch in terminal:', err);
      onError('Failed to open terminal');
    }
  };

  const [arranging, setArranging] = useState(false);

  const handleArrange = async () => {
    try {
      setArranging(true);
      await api.launch(0, '/orchestrator arrange');
    } catch (err) {
      console.error('Failed to launch arrange:', err);
      onError('Failed to launch arrange');
      setArranging(false);
    }
  };

  const handleRetryFailed = async (items: LaunchPhaseItem[], phaseIndex?: number) => {
    // Filter to only errored tasks
    const fresh = dataRef.current;
    if (!fresh) return;
    const taskMap = new Map((fresh.tasks || []).map(t => [t.id, t]));
    const errored = items.filter(i => {
      const task = taskMap.get(i.key);
      if (!task || task.status !== 'in-progress') return false;
      const p = (task.progress || '').toLowerCase();
      return /exited with code|error|failed|limit|blocked/i.test(p);
    });
    if (errored.length === 0) return;
    // Reset errored tasks to pending first, then launch
    const resetTasks = (fresh.tasks || []).map(t =>
      errored.some(e => e.key === t.id) ? { ...t, status: 'pending' as const, progress: undefined } : t
    );
    save({ ...fresh, tasks: resetTasks });
    await handleLaunchPhase(errored, phaseIndex);
  };

  return {
    launchedIds,
    launchMode,
    setLaunchMode,
    arranging,
    setArranging,
    handleQueue,
    handleQueueAll,
    handleQueueGroup,
    handleRemoveFromQueue,
    handleClearQueue,
    handleLaunchTask,
    handleLaunchPhase,
    handleRetryFailed,
    handleLaunchTerminal,
    handleArrange,
  };
}
