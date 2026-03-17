import { useState } from 'react';
import { ensureDevManagerDir } from '../fs.js';
import { STATUS } from '../constants/statuses.js';

// Topological sort: dependencies come before dependents
function sortByDependencies(queueItems, allTasks) {
  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  const queueIds = new Set(queueItems.map(q => q.task));

  // Build adjacency: for each queued item, which other queued items must come before it?
  const inDegree = new Map();
  const edges = new Map(); // from -> [to]
  for (const item of queueItems) {
    inDegree.set(item.task, 0);
    edges.set(item.task, []);
  }
  for (const item of queueItems) {
    const task = taskMap.get(item.task);
    if (task && task.dependsOn) {
      for (const depId of task.dependsOn) {
        if (queueIds.has(depId)) {
          edges.get(depId).push(item.task);
          inDegree.set(item.task, (inDegree.get(item.task) || 0) + 1);
        }
      }
    }
  }

  // Kahn's algorithm
  const result = [];
  const ready = queueItems.filter(q => (inDegree.get(q.task) || 0) === 0).map(q => q.task);
  const itemMap = new Map(queueItems.map(q => [q.task, q]));
  while (ready.length > 0) {
    const id = ready.shift();
    result.push(itemMap.get(id));
    for (const next of (edges.get(id) || [])) {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) ready.push(next);
    }
  }
  // Append any remaining (cyclic) items at end
  for (const item of queueItems) {
    if (!result.includes(item)) result.push(item);
  }
  return result;
}

function launchProtocol(url) {
  const a = document.createElement('a');
  a.href = url;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function useQueueActions({ data, save, dirHandle, projectPath, snapshotBeforeAction, onError }) {
  const [launchedId, setLaunchedId] = useState(null);

  const tasks = data?.tasks || [];
  const queue = data?.queue || [];
  const taskNotes = data?.taskNotes || {};

  const updateData = (partial) => {
    save({ ...data, ...partial });
  };

  const addActivity = (label, taskId) => {
    const entry = { id: 'act_' + Date.now(), time: Date.now(), label };
    if (taskId != null) entry.taskId = taskId;
    return [entry, ...(data?.activity || [])].slice(0, 20);
  };

  const handleQueue = (task) => {
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

  const handleQueueGroup = (groupName) => {
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

  const handleRemoveFromQueue = (key) => {
    const newQueue = queue.filter(q => q.task !== key);
    updateData({ queue: newQueue });
  };

  const handleClearQueue = () => {
    if (queue.length === 0) return;
    snapshotBeforeAction('Queue cleared');
    updateData({ queue: [] });
  };

  const handleLaunchTask = (itemKey, cmd, taskName) => {
    if (!projectPath) return; // UI shows "set path" prompt
    const path = projectPath.replace(/\\/g, '/');
    // Short tab title: first 2-3 meaningful words
    const filler = new Set(['the','a','an','for','to','of','in','as','and','with','me','my','its','is','be']);
    const words = taskName.split(/\s+/).filter(w => !filler.has(w.toLowerCase()));
    const title = words.slice(0, 2).join(' ') || taskName.split(/\s+/).slice(0, 2).join(' ');
    const url = 'claudecode:' + path + '?' + cmd + '?' + title;
    launchProtocol(url);
    setLaunchedId(itemKey);
    setTimeout(() => setLaunchedId(null), 3000);
  };

  const handleLaunchPhase = async (items) => {
    if (!projectPath || !dirHandle) return;
    const dir = projectPath.replace(/\\/g, '\\');
    const filler = new Set(['the','a','an','for','to','of','in','as','and','with','me','my','its','is','be']);
    const shortTitle = (name) => {
      const words = name.split(/\s+/).filter(w => !filler.has(w.toLowerCase()));
      return words.slice(0, 2).join(' ') || name.split(/\s+/).slice(0, 2).join(' ');
    };

    // Escape for PowerShell single-quoted strings: double any single quotes
    const escapePS = (s) => s.replace(/'/g, "''");
    // Escape for cmd.exe double-quoted strings: escape double quotes
    const escapeCmd = (s) => s.replace(/"/g, '""');

    try {
      const dmDir = await ensureDevManagerDir(dirHandle);

      // Write a per-task .ps1 script for each item (avoids nested-quote issues)
      for (const item of items) {
        const taskScript = `$Host.UI.RawUI.WindowTitle = '${escapePS(shortTitle(item.taskName))}'\r\nclaude --dangerously-skip-permissions '${item.cmd}'\r\n`;
        const fh = await dmDir.getFileHandle(`launch-${item.key}.ps1`, { create: true });
        const w = await fh.createWritable();
        await w.write(taskScript);
        await w.close();
      }

      // Build wt.exe command referencing the per-task scripts
      const tabArgs = items.map(item =>
        `new-tab --title "${escapeCmd(shortTitle(item.taskName))}" --suppressApplicationTitle -d "${dir}" pwsh -NoLogo -NoExit -File "${dir}\\.devmanager\\launch-${item.key}.ps1"`
      ).join(' ; ');
      const script = `@echo off\r\nstart "" wt.exe -w 0 ${tabArgs}\r\n`;

      // Write .devmanager/launch.cmd
      const fileHandle = await dmDir.getFileHandle('launch.cmd', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(script);
      await writable.close();
    } catch (err) {
      console.error('Failed to write launch scripts:', err);
      if (onError) onError('Failed to write launch scripts');
      return;
    }

    // Single protocol call
    const path = projectPath.replace(/\\/g, '/');
    launchProtocol('claudecode:' + path + '?__launch_file?Launch phase');

    // Mark all as launched
    items.forEach(item => {
      setLaunchedId(item.key);
    });
    setTimeout(() => setLaunchedId(null), 3000);
  };

  const handleArrange = () => {
    if (!projectPath) return;
    const path = projectPath.replace(/\\/g, '/');
    const url = 'claudecode:' + path + '?/orchestrator arrange?Arrange tasks';
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
