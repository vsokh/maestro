import React, { useState, useEffect } from 'react';
import { useProject } from './hooks/useProject.js';
import { saveAttachment, deleteAttachment, ensureDevManagerDir } from './fs.js';
import { ProjectPicker } from './components/ProjectPicker.jsx';
import { Header } from './components/Header.jsx';
import { SectionHeader } from './components/SectionHeader.jsx';
import { TaskBoard } from './components/TaskBoard.jsx';
import { TaskDetail } from './components/TaskDetail.jsx';
import { CommandQueue } from './components/CommandQueue.jsx';
import { ActivityFeed } from './components/ActivityFeed.jsx';

// Topological sort: dependencies come before dependents
function sortByDependencies(queueItems, allTasks) {
  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  const queueIds = new Set(queueItems.map(q => q.task));

  // Build adjacency: for each queued item, which other queued items must come before it?
  const inDegree = new Map();
  const edges = new Map(); // from → [to]
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

export function App() {
  const project = useProject();
  const { connected, status, projectName, data, save, connect, reconnect, disconnect, lastProjectName, dirHandle, pauseTask, cancelTask } = project;

  // Selection state (local only)
  const [selectedTask, setSelectedTask] = useState(null);

  // Project path for protocol launcher (per project, stored in localStorage)
  const [projectPath, setProjectPathState] = useState('');
  const [launchedId, setLaunchedId] = useState(null);

  // Re-read project path when projectName changes (after connection)
  useEffect(() => {
    if (!projectName) return;
    try {
      const paths = JSON.parse(localStorage.getItem('dm_project_paths') || '{}');
      setProjectPathState(paths[projectName] || '');
    } catch {}
  }, [projectName]);

  // If not connected, show picker
  if (!connected || !data) {
    return (
      <ProjectPicker
        onConnect={connect}
        onReconnect={reconnect}
        lastProjectName={lastProjectName}
        status={status}
      />
    );
  }

  // Convenience accessors
  const tasks = data.tasks || [];
  const epics = data.epics || [];
  const queue = data.queue || [];
  const taskNotes = data.taskNotes || {};
  const activity = data.activity || [];

  // Helpers to update data and trigger save
  const updateData = (partial) => {
    const next = { ...data, ...partial };
    save(next);
  };

  const addActivity = (label) => {
    const entry = { id: 'act_' + Date.now(), time: Date.now(), label };
    const next = [entry, ...(data.activity || [])].slice(0, 20);
    return next;
  };

  // Task handlers
  const handleSelectTask = (id) => {
    setSelectedTask(prev => prev === id ? null : id);
  };

  const handleUpdateTask = (id, updates) => {
    const newTasks = tasks.map(t => t.id === id ? { ...t, ...updates } : t);
    const newActivity = addActivity((tasks.find(t => t.id === id)?.name || 'Task') + (updates.status ? ' marked ' + updates.status : ' updated'));
    updateData({ tasks: newTasks, activity: newActivity });
  };

  const handleUpdateNotes = (id, note) => {
    updateData({ taskNotes: { ...taskNotes, [id]: note } });
  };

  const handleAddTask = (taskData) => {
    const maxId = tasks.reduce((max, t) => Math.max(max, typeof t.id === 'number' ? t.id : 0), 0);
    const newTask = { ...taskData, id: maxId + 1, createdAt: new Date().toISOString() };
    const newTasks = [...tasks, newTask];
    const newActivity = addActivity('"' + newTask.name + '" added');
    updateData({ tasks: newTasks, activity: newActivity });
  };

  const handleRenameGroup = (oldName, newName) => {
    const newTasks = tasks.map(t => t.group === oldName ? { ...t, group: newName } : t);
    const newEpics = epics.map(e => e.name === oldName ? { ...e, name: newName } : e);
    updateData({ tasks: newTasks, epics: newEpics });
  };

  const handleUpdateEpics = (newEpics) => {
    updateData({ epics: newEpics });
  };

  const handleDeleteTask = (id) => {
    const task = tasks.find(t => t.id === id);
    // Remove the task and clean up dependsOn references in other tasks
    const newTasks = tasks.filter(t => t.id !== id).map(t =>
      t.dependsOn ? { ...t, dependsOn: t.dependsOn.filter(d => d !== id) } : t
    );
    const newQueue = queue.filter(q => q.task !== id);
    const { [id]: _, ...newTaskNotes } = taskNotes;
    const newActivity = addActivity((task?.name || 'Task') + ' deleted');
    updateData({ tasks: newTasks, queue: newQueue, taskNotes: newTaskNotes, activity: newActivity });
    setSelectedTask(null);
  };

  const handleAddAttachment = async (taskId, file) => {
    if (!dirHandle) return;
    try {
      const filename = file.name;
      const path = await saveAttachment(dirHandle, taskId, filename, file);
      const attachment = { id: 'att_' + Date.now(), filename, path };
      const task = tasks.find(t => t.id === taskId);
      const attachments = [...(task?.attachments || []), attachment];
      handleUpdateTask(taskId, { attachments });
    } catch (err) {
      console.error('Failed to save attachment:', err);
    }
  };

  const handleDeleteAttachment = async (taskId, attachmentId) => {
    if (!dirHandle) return;
    try {
      const task = tasks.find(t => t.id === taskId);
      const att = (task?.attachments || []).find(a => a.id === attachmentId);
      if (att) await deleteAttachment(dirHandle, taskId, att.filename);
      const attachments = (task?.attachments || []).filter(a => a.id !== attachmentId);
      handleUpdateTask(taskId, { attachments });
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  };

  const handleQueue = (task) => {
    if (queue.some(q => q.task === task.id)) return;
    const unsorted = [...queue, {
      task: task.id,
      taskName: task.name,
      notes: taskNotes[task.id] || '',
    }];
    const newQueue = sortByDependencies(unsorted, tasks);
    const newActivity = addActivity(task.name + ' queued');
    updateData({ queue: newQueue, activity: newActivity });
  };

  const handleQueueAll = () => {
    const pending = tasks.filter(t => (t.status === 'pending' || t.status === 'paused') && !queue.some(q => q.task === t.id));
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

  const handleRemoveFromQueue = (key) => {
    const newQueue = queue.filter(q => q.task !== key);
    updateData({ queue: newQueue });
  };

  const handleClearQueue = () => {
    updateData({ queue: [] });
  };

  const launchProtocol = (url) => {
    const a = document.createElement('a');
    a.href = url;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleArrange = () => {
    if (!projectPath) return;
    const path = projectPath.replace(/\\/g, '/');
    const url = 'claudecode:' + path + '?/orchestrator arrange?Arrange tasks';
    launchProtocol(url);
  };

  const handleLaunchPhase = async (items) => {
    if (!projectPath || !dirHandle) return;
    const dir = projectPath.replace(/\\/g, '\\');
    const filler = new Set(['the','a','an','for','to','of','in','as','and','with','me','my','its','is','be']);
    const shortTitle = (name) => {
      const words = name.split(/\s+/).filter(w => !filler.has(w.toLowerCase()));
      return words.slice(0, 2).join(' ') || name.split(/\s+/).slice(0, 2).join(' ');
    };

    try {
      const dmDir = await ensureDevManagerDir(dirHandle);

      // Write a per-task .cmd script for each item (avoids nested-quote issues)
      for (const item of items) {
        const taskScript = `@echo off\r\ntitle ${shortTitle(item.taskName)}\r\nclaude --dangerously-skip-permissions "${item.cmd}"\r\n`;
        const fh = await dmDir.getFileHandle(`launch-${item.key}.cmd`, { create: true });
        const w = await fh.createWritable();
        await w.write(taskScript);
        await w.close();
      }

      // Build wt.exe command referencing the per-task scripts
      const tabArgs = items.map(item =>
        `new-tab --title "${shortTitle(item.taskName)}" --suppressApplicationTitle -d "${dir}" cmd /k "${dir}\\.devmanager\\launch-${item.key}.cmd"`
      ).join(' ; ');
      const script = `@echo off\r\nstart "" wt.exe -w 0 ${tabArgs}\r\n`;

      // Write .devmanager/launch.cmd
      const fileHandle = await dmDir.getFileHandle('launch.cmd', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(script);
      await writable.close();
    } catch (err) {
      console.error('Failed to write launch scripts:', err);
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

  const handleRemoveActivity = (id) => {
    const newActivity = activity.filter(a => a.id !== id);
    updateData({ activity: newActivity });
  };

  const setProjectPath = (path) => {
    setProjectPathState(path);
    try {
      const paths = JSON.parse(localStorage.getItem('dm_project_paths') || '{}');
      paths[projectName] = path;
      localStorage.setItem('dm_project_paths', JSON.stringify(paths));
    } catch {}
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

  // Selected task data
  const selectedTaskData = tasks.find(t => t.id === selectedTask) || null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header projectName={projectName} status={status} onDisconnect={disconnect} />

      <div className="dm-container">

        {/* Top row: Tasks + Detail */}
        <div className="dm-grid-top">
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <SectionHeader title="Product" />
            <div style={{ padding: '16px' }}>
              <TaskBoard
                tasks={tasks}
                selectedTask={selectedTask}
                onSelectTask={handleSelectTask}
                onAddTask={handleAddTask}
                onQueueAll={handleQueueAll}
                onArrange={handleArrange}
                onPauseTask={pauseTask}
                onCancelTask={cancelTask}
                onRenameGroup={handleRenameGroup}
                epics={epics}
                onUpdateEpics={handleUpdateEpics}
                queue={queue}
              />
            </div>
          </div>

          {selectedTask && (
            <div className={'dm-detail-backdrop' + (selectedTask ? ' open' : '')} onClick={() => setSelectedTask(null)} />
          )}
          <div className={'dm-detail-panel' + (selectedTask ? ' open' : '')} style={{
            background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column',
          }}>
            <SectionHeader title="Detail" />
            <TaskDetail
              task={selectedTaskData}
              tasks={tasks}
              epics={epics}
              onQueue={handleQueue}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              notes={taskNotes[selectedTask] || ''}
              onUpdateNotes={handleUpdateNotes}
              dirHandle={dirHandle}
              onAddAttachment={handleAddAttachment}
              onDeleteAttachment={handleDeleteAttachment}
            />
          </div>
        </div>

        {/* Bottom row: Queue + Activity */}
        <div className="dm-grid-bottom">
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <SectionHeader title="Queue" count={queue.length > 0 ? queue.length : null} />
            <CommandQueue queue={queue} tasks={tasks} onLaunch={handleLaunchTask} onLaunchPhase={handleLaunchPhase} onRemove={handleRemoveFromQueue} onClear={handleClearQueue} onQueueAll={handleQueueAll} onPauseTask={pauseTask} launchedId={launchedId} projectPath={projectPath} onSetPath={setProjectPath} />
          </div>

          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <SectionHeader title="Activity" />
            <ActivityFeed activity={activity} onRemove={handleRemoveActivity} />
          </div>
        </div>
      </div>
    </div>
  );
}
