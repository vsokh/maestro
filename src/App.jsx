import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProject } from './hooks/useProject.js';
import { useTaskActions } from './hooks/useTaskActions.js';
import { useQueueActions } from './hooks/useQueueActions.js';
import { snapshotState } from './fs.js';
import { ProjectPicker } from './components/ProjectPicker.jsx';
import { Header } from './components/Header.jsx';
import { SectionHeader } from './components/SectionHeader.jsx';
import { TaskBoard } from './components/TaskBoard.jsx';
import { TaskDetail } from './components/TaskDetail.jsx';
import { CommandQueue } from './components/CommandQueue.jsx';
import { ActivityFeed } from './components/ActivityFeed.jsx';
import { UndoToast } from './components/UndoToast.jsx';
import { QualityPanel } from './components/QualityPanel.jsx';
import { useQuality } from './hooks/useQuality.js';

export function App() {
  const project = useProject();
  const { connected, status, projectName, data, save, connect, reconnect, disconnect, lastProjectName, dirHandle, pauseTask, cancelTask } = project;

  // Set browser tab title to project name
  useEffect(() => {
    document.title = projectName || 'Dev Manager';
  }, [projectName]);

  // Selection state (local only)
  const [selectedTask, setSelectedTask] = useState(null);

  // Product panel tab: 'board' or 'quality'
  const [productTab, setProductTab] = useState('board');

  // Quality data (reads .devmanager/quality/)
  const quality = useQuality(dirHandle);

  // Project path for protocol launcher (per project, stored in localStorage)
  const [projectPath, setProjectPathState] = useState('');

  // Undo stack: stores previous state before destructive operations
  const [undoEntry, setUndoEntry] = useState(null);
  const undoTimer = useRef(null);

  const snapshotBeforeAction = useCallback((label) => {
    if (dirHandle && data) {
      snapshotState(dirHandle); // fire-and-forget backup to disk
    }
    clearTimeout(undoTimer.current);
    setUndoEntry({ data: structuredClone(data), label, timestamp: Date.now() });
    undoTimer.current = setTimeout(() => setUndoEntry(null), 8000);
  }, [dirHandle, data]);

  const handleUndo = useCallback(() => {
    if (!undoEntry) return;
    save(undoEntry.data);
    clearTimeout(undoTimer.current);
    setUndoEntry(null);
  }, [undoEntry, save]);

  // --- Extracted hooks (must be called before any early returns) ---
  const taskActions = useTaskActions({ data, save, dirHandle, snapshotBeforeAction });
  const queueActions = useQueueActions({ data, save, dirHandle, projectPath, snapshotBeforeAction });

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

  // Wrap deleteTask to clear selection
  const handleDeleteTask = (id) => {
    taskActions.handleDeleteTask(id);
    setSelectedTask(null);
  };

  // Task selection (local state only)
  const handleSelectTask = (id) => {
    setSelectedTask(prev => prev === id ? null : id);
  };

  const handleRemoveActivity = (id) => {
    snapshotBeforeAction('Activity removed');
    const newActivity = activity.filter(a => a.id !== id);
    save({ ...data, activity: newActivity });
  };

  const setProjectPath = (path) => {
    setProjectPathState(path);
    try {
      const paths = JSON.parse(localStorage.getItem('dm_project_paths') || '{}');
      paths[projectName] = path;
      localStorage.setItem('dm_project_paths', JSON.stringify(paths));
    } catch {}
  };

  // Selected task data
  const selectedTaskData = tasks.find(t => t.id === selectedTask) || null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header projectName={projectName} status={status} onDisconnect={disconnect} />

      <div className="dm-container">

        {/* Tab bar */}
        <div style={{
          background: 'var(--dm-surface)', borderRadius: 'var(--dm-radius)', border: '1px solid var(--dm-border)',
          boxShadow: 'var(--dm-shadow-sm)', marginBottom: productTab === 'quality' ? 0 : undefined,
        }}>
          <SectionHeader title="" extra={
            <div style={{ display: 'flex', gap: 0, width: '100%' }}>
              {['board', 'quality'].map(tab => (
                <button
                  key={tab}
                  onClick={() => { setProductTab(tab); if (tab === 'quality') setSelectedTask(null); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 12px',
                    fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: productTab === tab ? 'var(--dm-accent)' : 'var(--dm-text-muted)',
                    borderBottom: productTab === tab ? '2px solid var(--dm-accent)' : '2px solid transparent',
                    marginBottom: -1,
                    fontFamily: 'inherit',
                  }}
                >
                  {tab === 'board' ? 'Board' : 'Quality'}
                </button>
              ))}
            </div>
          } />

          {/* Quality: full-width, single panel */}
          {productTab === 'quality' && (
            <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
              <QualityPanel latest={quality.latest} history={quality.history} loading={quality.loading} projectPath={projectPath} />
            </div>
          )}
        </div>

        {/* Board mode: original 2×2 grid */}
        {productTab === 'board' && (
          <>
            {/* Top row: Tasks + Detail */}
            <div className="dm-grid-top">
              <div style={{
                background: 'var(--dm-surface)', borderRadius: 'var(--dm-radius)', border: '1px solid var(--dm-border)',
                boxShadow: 'var(--dm-shadow-sm)',
              }}>
                <div style={{ padding: '16px' }}>
                  <TaskBoard
                    tasks={tasks}
                    selectedTask={selectedTask}
                    onSelectTask={handleSelectTask}
                    onAddTask={taskActions.handleAddTask}
                    onQueueAll={queueActions.handleQueueAll}
                    onArrange={queueActions.handleArrange}
                    onPauseTask={pauseTask}
                    onCancelTask={cancelTask}
                    onRenameGroup={taskActions.handleRenameGroup}
                    epics={epics}
                    onUpdateEpics={taskActions.handleUpdateEpics}
                    queue={queue}
                  />
                </div>
              </div>

              {selectedTask && (
                <div className={'dm-detail-backdrop' + (selectedTask ? ' open' : '')} onClick={() => setSelectedTask(null)} />
              )}
              <div className={'dm-detail-panel' + (selectedTask ? ' open' : '')} style={{
                background: 'var(--dm-surface)', borderRadius: 'var(--dm-radius)', border: '1px solid var(--dm-border)',
                boxShadow: 'var(--dm-shadow-sm)',
              }}>
                <SectionHeader title="Detail" />
                <TaskDetail
                  task={selectedTaskData}
                  tasks={tasks}
                  epics={epics}
                  onQueue={queueActions.handleQueue}
                  onUpdateTask={taskActions.handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  notes={taskNotes[selectedTask] || ''}
                  onUpdateNotes={taskActions.handleUpdateNotes}
                  dirHandle={dirHandle}
                  onAddAttachment={taskActions.handleAddAttachment}
                  onDeleteAttachment={taskActions.handleDeleteAttachment}
                />
              </div>
            </div>

            {/* Bottom row: Queue + Activity */}
            <div className="dm-grid-bottom">
              <div style={{
                background: 'var(--dm-surface)', borderRadius: 'var(--dm-radius)', border: '1px solid var(--dm-border)',
                boxShadow: 'var(--dm-shadow-sm)',
              }}>
                <SectionHeader title="Queue" count={queue.length > 0 ? queue.length : null} />
                <CommandQueue queue={queue} tasks={tasks} onLaunch={queueActions.handleLaunchTask} onLaunchPhase={queueActions.handleLaunchPhase} onRemove={queueActions.handleRemoveFromQueue} onClear={queueActions.handleClearQueue} onQueueAll={queueActions.handleQueueAll} onPauseTask={pauseTask} launchedId={queueActions.launchedId} projectPath={projectPath} onSetPath={setProjectPath} />
              </div>

              <div style={{
                background: 'var(--dm-surface)', borderRadius: 'var(--dm-radius)', border: '1px solid var(--dm-border)',
                boxShadow: 'var(--dm-shadow-sm)',
              }}>
                <SectionHeader title="Activity" />
                <ActivityFeed activity={activity} onRemove={handleRemoveActivity} />
              </div>
            </div>
          </>
        )}
      </div>
      <UndoToast entry={undoEntry} onUndo={handleUndo} onDismiss={() => { clearTimeout(undoTimer.current); setUndoEntry(null); }} />
    </div>
  );
}
