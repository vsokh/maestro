import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProject } from './hooks/useProject.ts';
import { useTaskActions } from './hooks/useTaskActions.ts';
import { useQueueActions } from './hooks/useQueueActions.ts';
import { useFocusTrap } from './hooks/useFocusTrap.ts';
import { useUndo } from './hooks/useUndo.ts';
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
import { SkillsConfigPanel } from './components/SkillsConfigPanel.tsx';
import { useQuality } from './hooks/useQuality.ts';
import { APP_NAME, TAB_BOARD, TAB_QUALITY } from './constants/strings.ts';

export function App() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showError = useCallback((msg: string) => {
    setErrorMessage(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorMessage(null), 5000);
  }, []);

  const project = useProject({ onError: showError });
  const { connected, status, projectName, data, save, connect, disconnect, pauseTask, cancelTask, skillsConfig, saveSkills, availableSkills, projects, switchProject, showTemplatePicker, connectWithTemplate, cancelTemplatePicker } = project;

  useEffect(() => {
    document.title = projectName || APP_NAME;
  }, [projectName]);

  const [selectedTask, setSelectedTask] = useState<number | null>(null);

  const [productTab, setProductTab] = useState<'board' | 'quality'>('board');
  const [showSkillsConfig, setShowSkillsConfig] = useState(false);

  const [glowTaskId, setGlowTaskId] = useState<number | null>(null);
  const glowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detailPanelRef = useFocusTrap(selectedTask != null);

  const quality = useQuality();

  const { undoEntry, snapshotBeforeAction, handleUndo, dismissUndo } = useUndo({ data, save, showError });

  const taskActions = useTaskActions({ data, save, snapshotBeforeAction, onError: showError });
  const queueActions = useQueueActions({ data, save, snapshotBeforeAction, onError: showError });

  if (!connected || !data) {
    return (
      <ProjectPicker
        onConnect={connect}
        status={status}
        showTemplatePicker={showTemplatePicker}
        onSelectTemplate={connectWithTemplate}
        onCancelTemplate={cancelTemplatePicker}
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

  const selectedTaskData = tasks.find(t => t.id === selectedTask) || null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header projectName={projectName} status={status} projects={projects} onSwitchProject={switchProject} onOpenSkills={() => setShowSkillsConfig(true)} defaultEngine={data.defaultEngine} onSetDefaultEngine={(engineId: string) => save({ ...data, defaultEngine: engineId })} />

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
                  {tab === 'board' ? TAB_BOARD : TAB_QUALITY}
                </button>
              ))}
            </div>
          } />

          {productTab === 'quality' && (
            <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
              <QualityPanel latest={quality.latest} history={quality.history} loading={quality.loading} error={quality.error} onRetry={quality.retry} />
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
                    skillsConfig={skillsConfig}
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
                  onAddAttachment={taskActions.handleAddAttachment}
                  onDeleteAttachment={taskActions.handleDeleteAttachment}
                  availableSkills={availableSkills}
                  defaultEngine={data.defaultEngine}
                />
              </div>
            </div>

            <div className="dm-grid-bottom">
              <div className="panel">
                <SectionHeader title="Queue" count={queue.length > 0 ? queue.length : null} />
                <CommandQueue queue={queue} tasks={tasks} onLaunch={queueActions.handleLaunchTask} onLaunchPhase={queueActions.handleLaunchPhase} onRemove={queueActions.handleRemoveFromQueue} onClear={queueActions.handleClearQueue} onQueueAll={queueActions.handleQueueAll} onPauseTask={pauseTask} onUpdateTask={taskActions.handleUpdateTask} onBatchUpdateTasks={taskActions.handleBatchUpdateTasks} launchedId={queueActions.launchedId} defaultEngine={data.defaultEngine} />
              </div>

              <div className="panel">
                <SectionHeader title="Activity" />
                <ActivityFeed activity={activity} onRemove={handleRemoveActivity} tasks={tasks} onNavigateToTask={handleNavigateToTask} />
              </div>
            </div>
          </>
        )}
      </div>
      {showSkillsConfig ? (
        <SkillsConfigPanel
          config={skillsConfig}
          availableSkills={availableSkills}
          epicNames={[...new Set([...epics.map(e => e.name), ...tasks.map(t => t.group).filter(Boolean) as string[]])]}
          onSave={(cfg) => saveSkills(cfg)}
          onClose={() => setShowSkillsConfig(false)}
        />
      ) : null}
      <UndoToast entry={undoEntry} onUndo={handleUndo} onDismiss={dismissUndo} />
      <ErrorToast message={errorMessage} onDismiss={() => { if (errorTimer.current) clearTimeout(errorTimer.current); setErrorMessage(null); }} />
    </div>
  );
}
