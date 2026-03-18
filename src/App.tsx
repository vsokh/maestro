import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProject } from './hooks/useProject.ts';
import { useTaskActions } from './hooks/useTaskActions.ts';
import { useQueueActions } from './hooks/useQueueActions.ts';
import { snapshotState } from './fs.ts';
import { ProjectPicker } from './components/ProjectPicker.tsx';
import { Header } from './components/Header.tsx';
import { SectionHeader } from './components/SectionHeader.tsx';
import { TaskBoard } from './components/TaskBoard.tsx';
import { TaskDetail } from './components/TaskDetail.tsx';
import { CommandQueue } from './components/CommandQueue.tsx';
import { ActivityFeed } from './components/ActivityFeed.tsx';
import { UndoToast } from './components/UndoToast.tsx';
import { ErrorToast } from './components/ErrorToast.tsx';
import { QualityPanel } from './components/QualityPanel.tsx';
import { useQuality } from './hooks/useQuality.ts';
import type { StateData, UndoEntry } from './types';

export function App() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showError = useCallback((msg: string) => {
    setErrorMessage(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorMessage(null), 5000);
  }, []);

  const project = useProject({ onError: showError });
  const { connected, status, projectName, data, save, connect, reconnect, disconnect, lastProjectName, dirHandle, pauseTask, cancelTask } = project;

  useEffect(() => {
    document.title = projectName || 'Dev Manager';
  }, [projectName]);

  const [selectedTask, setSelectedTask] = useState<number | null>(null);

  const [productTab, setProductTab] = useState<'board' | 'quality'>('board');

  const [glowTaskId, setGlowTaskId] = useState<number | null>(null);
  const glowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detailPanelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  const quality = useQuality(dirHandle);

  const [projectPath, setProjectPathState] = useState('');

  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapshotBeforeAction = useCallback((label: string) => {
    if (dirHandle && data) {
      snapshotState(dirHandle, showError);
    }
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoEntry({ data: structuredClone(data) as StateData, label, timestamp: Date.now() });
    undoTimer.current = setTimeout(() => setUndoEntry(null), 8000);
  }, [dirHandle, data]);

  const handleUndo = useCallback(() => {
    if (!undoEntry) return;
    save(undoEntry.data);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoEntry(null);
  }, [undoEntry, save]);

  const taskActions = useTaskActions({ data, save, dirHandle, snapshotBeforeAction, onError: showError });
  const queueActions = useQueueActions({ data, save, dirHandle, projectPath, snapshotBeforeAction, onError: showError });

  useEffect(() => {
    if (!projectName) return;
    try {
      const paths = JSON.parse(localStorage.getItem('dm_project_paths') || '{}');
      setProjectPathState(paths[projectName] || '');
    } catch (err) { console.error('Failed to read dm_project_paths from localStorage:', err); }
  }, [projectName]);

  // Focus trap for mobile detail panel
  useEffect(() => {
    if (!selectedTask) {
      // Restore focus when panel closes
      if (previousFocusRef.current && previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
      return;
    }

    // Save the currently focused element
    previousFocusRef.current = document.activeElement;

    const panel = detailPanelRef.current;
    if (!panel) return;

    const focusableSelector = 'button, input, select, textarea, [tabindex]:not([tabindex="-1"]), a[href]';

    // Focus the first focusable element in the panel
    const focusFirst = () => {
      const focusable = panel.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    };

    // Delay slightly to ensure the panel is rendered
    const rafId = requestAnimationFrame(focusFirst);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    panel.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(rafId);
      panel.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedTask]);

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

  const tasks = data.tasks || [];
  const epics = data.epics || [];
  const queue = data.queue || [];
  const taskNotes = data.taskNotes || {};
  const activity = data.activity || [];

  const handleDeleteTask = (id: number) => {
    taskActions.handleDeleteTask(id);
    setSelectedTask(null);
  };

  const handleSelectTask = (id: number | null) => {
    setSelectedTask(prev => prev === id ? null : id);
  };

  const handleRemoveActivity = (id: string) => {
    snapshotBeforeAction('Activity removed');
    const newActivity = activity.filter(a => a.id !== id);
    save({ ...data, activity: newActivity });
  };

  const handleNavigateToTask = (taskId: number) => {
    setSelectedTask(taskId);
    setProductTab('board');
    if (glowTimer.current) clearTimeout(glowTimer.current);
    setGlowTaskId(taskId);
    glowTimer.current = setTimeout(() => setGlowTaskId(null), 1500);
    let attempts = 0;
    const tryScroll = () => {
      const el = document.querySelector(`[data-task-id="${taskId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (attempts < 5) {
        attempts++;
        setTimeout(tryScroll, 80);
      }
    };
    setTimeout(tryScroll, 50);
  };

  const setProjectPath = (path: string) => {
    setProjectPathState(path);
    try {
      const paths = JSON.parse(localStorage.getItem('dm_project_paths') || '{}');
      paths[projectName] = path;
      localStorage.setItem('dm_project_paths', JSON.stringify(paths));
    } catch (err) { console.error('Failed to save dm_project_paths to localStorage:', err); }
  };

  const selectedTaskData = tasks.find(t => t.id === selectedTask) || null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header projectName={projectName} status={status} onDisconnect={disconnect} />

      <div className="dm-container">

        {/* Tab bar */}
        <div className="panel" style={{
          marginBottom: productTab === 'quality' ? 0 : undefined,
        }}>
          <SectionHeader title="" extra={
            <div style={{ display: 'flex', gap: 0, width: '100%' }}>
              {(['board', 'quality'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setProductTab(tab); if (tab === 'quality') setSelectedTask(null); }}
                  className={`btn-tab ${productTab === tab ? 'btn-tab--active' : 'btn-tab--inactive'}`}
                  style={{ padding: '0 12px', marginBottom: -1 }}
                >
                  {tab === 'board' ? 'Board' : 'Quality'}
                </button>
              ))}
            </div>
          } />

          {productTab === 'quality' && (
            <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
              <QualityPanel latest={quality.latest} history={quality.history} loading={quality.loading} error={quality.error} onRetry={quality.retry} projectPath={projectPath} />
            </div>
          )}
        </div>

        {productTab === 'board' && (
          <>
            <div className="dm-grid-top">
              <div className="panel">
                <div style={{ padding: '16px' }}>
                  <TaskBoard
                    tasks={tasks}
                    selectedTask={selectedTask}
                    onSelectTask={handleSelectTask}
                    onAddTask={taskActions.handleAddTask}
                    onQueueAll={queueActions.handleQueueAll}
                    onQueueGroup={queueActions.handleQueueGroup}
                    onArrange={queueActions.handleArrange}
                    onPauseTask={pauseTask}
                    onCancelTask={cancelTask}
                    onRenameGroup={taskActions.handleRenameGroup}
                    epics={epics}
                    onUpdateEpics={taskActions.handleUpdateEpics}
                    queue={queue}
                    glowTaskId={glowTaskId}
                  />
                </div>
              </div>

              {selectedTask && (
                <div className={'dm-detail-backdrop' + (selectedTask ? ' open' : '')} onClick={() => setSelectedTask(null)} />
              )}
              <div
                ref={detailPanelRef}
                className={'dm-detail-panel' + (selectedTask ? ' open' : '')}
                role="dialog"
                aria-modal="true"
                aria-label="Task detail"
                style={{
                  background: 'var(--dm-surface)', borderRadius: 'var(--dm-radius)', border: '1px solid var(--dm-border)',
                  boxShadow: 'var(--dm-shadow-sm)',
                }}
              >
                <SectionHeader title="Detail" />
                <TaskDetail
                  task={selectedTaskData}
                  tasks={tasks}
                  epics={epics}
                  onQueue={queueActions.handleQueue}
                  onUpdateTask={taskActions.handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  notes={selectedTask ? (taskNotes[selectedTask] || '') : ''}
                  onUpdateNotes={taskActions.handleUpdateNotes}
                  dirHandle={dirHandle}
                  onAddAttachment={taskActions.handleAddAttachment}
                  onDeleteAttachment={taskActions.handleDeleteAttachment}
                />
              </div>
            </div>

            <div className="dm-grid-bottom">
              <div className="panel">
                <SectionHeader title="Queue" count={queue.length > 0 ? queue.length : null} />
                <CommandQueue queue={queue} tasks={tasks} onLaunch={queueActions.handleLaunchTask} onLaunchPhase={queueActions.handleLaunchPhase} onRemove={queueActions.handleRemoveFromQueue} onClear={queueActions.handleClearQueue} onQueueAll={queueActions.handleQueueAll} onPauseTask={pauseTask} onUpdateTask={taskActions.handleUpdateTask} onBatchUpdateTasks={taskActions.handleBatchUpdateTasks} launchedId={queueActions.launchedId} projectPath={projectPath} onSetPath={setProjectPath} />
              </div>

              <div className="panel">
                <SectionHeader title="Activity" />
                <ActivityFeed activity={activity} onRemove={handleRemoveActivity} tasks={tasks} onNavigateToTask={handleNavigateToTask} />
              </div>
            </div>
          </>
        )}
      </div>
      <UndoToast entry={undoEntry} onUndo={handleUndo} onDismiss={() => { if (undoTimer.current) clearTimeout(undoTimer.current); setUndoEntry(null); }} />
      <ErrorToast message={errorMessage} onDismiss={() => { if (errorTimer.current) clearTimeout(errorTimer.current); setErrorMessage(null); }} />
    </div>
  );
}
