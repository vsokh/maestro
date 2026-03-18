import { useState } from 'react';
import { ensureDevManagerDir } from '../fs.ts';
import { STATUS } from '../constants/statuses.ts';
import { sortByDependencies } from '../utils/sortByDependencies.ts';
import { escapePS, escapeCmd, shortTitle } from '../utils/queueUtils.ts';
import type { StateData, Task, QueueItem, Activity } from '../types';

function launchProtocol(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

interface UseQueueActionsParams {
  data: StateData | null;
  save: (data: StateData) => void;
  dirHandle: FileSystemDirectoryHandle | null;
  projectPath: string;
  snapshotBeforeAction: (label: string) => void;
  onError: (msg: string) => void;
}

interface LaunchPhaseItem {
  key: number;
  cmd: string;
  taskName: string;
}

export function useQueueActions({ data, save, dirHandle, projectPath, snapshotBeforeAction, onError }: UseQueueActionsParams) {
  const [launchedId, setLaunchedId] = useState<number | null>(null);

  const tasks: Task[] = data?.tasks || [];
  const queue: QueueItem[] = data?.queue || [];
  const taskNotes: Record<string, string> = data?.taskNotes || {};

  const updateData = (partial: Partial<StateData>) => {
    save({ ...data!, ...partial });
  };

  const addActivity = (label: string, taskId?: number): Activity[] => {
    const entry: Activity = { id: 'act_' + Date.now(), time: Date.now(), label };
    if (taskId != null) entry.taskId = taskId;
    return [entry, ...(data?.activity || [])].slice(0, 20);
  };

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
    const pending = tasks.filter(t => (t.status === STATUS.PENDING || t.status === STATUS.PAUSED) && !queue.some(q => q.task === t.id));
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
    const pending = tasks.filter(t => t.group === groupName && (t.status === STATUS.PENDING || t.status === STATUS.PAUSED) && !queue.some(q => q.task === t.id));
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

  const handleLaunchTask = (itemKey: number, cmd: string, taskName: string) => {
    if (!projectPath) return;
    const path = projectPath.replace(/\\/g, '/');
    const title = shortTitle(taskName);
    const url = 'claudecode:' + encodeURIComponent(path) + '?' + encodeURIComponent(cmd) + '?' + encodeURIComponent(title);
    launchProtocol(url);
    setLaunchedId(itemKey);
    setTimeout(() => setLaunchedId(null), 3000);
  };

  const handleLaunchPhase = async (items: LaunchPhaseItem[]) => {
    if (!projectPath || !dirHandle) return;
    const dir = projectPath.replace(/\\/g, '\\');

    try {
      const dmDir = await ensureDevManagerDir(dirHandle);

      for (const item of items) {
        const taskScript = `$Host.UI.RawUI.WindowTitle = '${escapePS(shortTitle(item.taskName))}'\r\nclaude --dangerously-skip-permissions '${escapePS(item.cmd)}'\r\n`;
        const fh = await dmDir.getFileHandle(`launch-${item.key}.ps1`, { create: true });
        const w = await fh.createWritable();
        await w.write(taskScript);
        await w.close();
      }

      const tabArgs = items.map(item =>
        `new-tab --title "${escapeCmd(shortTitle(item.taskName))}" --suppressApplicationTitle -d "${dir}" pwsh -NoLogo -NoExit -File "${dir}\\.devmanager\\launch-${item.key}.ps1"`
      ).join(' ; ');
      const script = `@echo off\r\nstart "" wt.exe -w 0 ${tabArgs}\r\n`;

      const fileHandle = await dmDir.getFileHandle('launch.cmd', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(script);
      await writable.close();
    } catch (err) {
      console.error('Failed to write launch scripts:', err);
      if (onError) onError('Failed to write launch scripts');
      return;
    }

    const path = projectPath.replace(/\\/g, '/');
    launchProtocol('claudecode:' + encodeURIComponent(path) + '?__launch_file?Launch%20phase');

    items.forEach(item => {
      setLaunchedId(item.key);
    });
    setTimeout(() => setLaunchedId(null), 3000);
  };

  const handleArrange = () => {
    if (!projectPath) return;
    const path = projectPath.replace(/\\/g, '/');
    const url = 'claudecode:' + encodeURIComponent(path) + '?' + encodeURIComponent('/orchestrator arrange') + '?' + encodeURIComponent('Arrange tasks');
    launchProtocol(url);
  };

  return {
    launchedId,
    handleQueue,
    handleQueueAll,
    handleQueueGroup,
    handleRemoveFromQueue,
    handleClearQueue,
    handleLaunchTask,
    handleLaunchPhase,
    handleArrange,
  };
}
