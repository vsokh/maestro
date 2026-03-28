import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useProject } from './hooks/useProject.ts';
import { useTaskActions } from './hooks/useTaskActions.ts';
import { useQueueActions } from './hooks/useQueueActions.ts';
import { useFocusTrap } from './hooks/useFocusTrap.ts';
import { useUndo } from './hooks/useUndo.ts';
import { useScratchpad } from './hooks/useScratchpad.ts';
import { useTabRouting } from './hooks/useTabRouting.ts';
import { ProjectPicker } from './components/ProjectPicker.tsx';
import { Header } from './components/Header.tsx';
import { SectionHeader } from './components/SectionHeader.tsx';
import { TaskBoard } from './components/TaskBoard.tsx';
import { TaskDetail } from './components/TaskDetail.tsx';
import { CommandQueue } from './components/CommandQueue.tsx';
import { ActivityFeed } from './components/ActivityFeed.tsx';
import { UndoToast } from './components/UndoToast.tsx';
import { ErrorToast } from './components/ErrorToast.tsx';
import { SplitResultToast } from './components/SplitResultToast.tsx';
import { QualityPanel } from './components/QualityPanel.tsx';
import { SkillsConfigPanel } from './components/SkillsConfigPanel.tsx';
import { FloatingScratchpad } from './components/FloatingScratchpad.tsx';
import { useQuality } from './hooks/useQuality.ts';
import { useProcessOutput } from './hooks/useProcessOutput.ts';
import { APP_NAME, TAB_BOARD, TAB_QUALITY } from './constants/strings.ts';
import { TASK_ID_CODEHEALTH, TASK_ID_AUTOFIX } from './components/quality/LaunchButtons.tsx';
import { ActionProvider } from './contexts/ActionContext.tsx';

export function App() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showError = useCallback((msg: string) => {
    setErrorMessage(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorMessage(null), 5000);
  }, []);

  const project = useProject({ onError: showError });
  const { connected, status, projectName, data, save, connect, disconnect: _disconnect, pauseTask, cancelTask, skillsConfig, saveSkills, availableSkills, projects, switchProject, showTemplatePicker, connectWithTemplate, cancelTemplatePicker } = project;

  useEffect(() => {
    document.title = projectName || APP_NAME;
  }, [projectName]);

  const [selectedTask, setSelectedTask] = useState<number | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());

  const { productTab, setProductTab } = useTabRouting();
  const [showSkillsConfig, setShowSkillsConfig] = useState(false);

  const [glowTaskId, setGlowTaskId] = useState<number | null>(null);
  const { showScratchpad, setShowScratchpad, splitting, splitResult, setSplitResult, splitResultTimer, handleSplitTasks } = useScratchpad({ data, save, showError });
  const glowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detailPanelRef = useFocusTrap(selectedTask != null);

  const quality = useQuality();
  const processOutput = useProcessOutput();

  const { undoEntry, snapshotBeforeAction, handleUndo, dismissUndo } = useUndo({ data, save, showError });

  const taskActions = useTaskActions({ data, save, snapshotBeforeAction, onError: showError });
  const queueActions = useQueueActions({ data, save, snapshotBeforeAction, onError: showError });

  // Reset arranging flag when arrange completes (activity entry appears)
  useEffect(() => {
    if (!queueActions.arranging || !data?.activity) return;
    const hasArrangeActivity = data.activity.some(a => a.id?.includes('_arrange') && Date.now() - a.time < 60000);
    if (hasArrangeActivity) queueActions.setArranging(false);
  }, [data?.activity, queueActions]);

  const tasks = data?.tasks || [];
  const epics = data?.epics || [];
  const queue = data?.queue || [];
  const taskNotes = data?.taskNotes || {};
  const activity = useMemo(() => data?.activity || [], [data?.activity]);

  const handleDeleteTask = useCallback((id: number) => {
    taskActions.handleDeleteTask(id);
    setSelectedTask(null);
  }, [taskActions]);

  const handleSelectTask = useCallback((id: number | null) => {
    setSelectedTask(prev => prev === id ? null : id);
  }, []);

  const handleToggleTaskSelection = useCallback((id: number) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (selectedTasks.size === 0) return;
    taskActions.handleBulkDeleteTasks([...selectedTasks]);
    setSelectedTasks(new Set());
    setSelectMode(false);
  }, [selectedTasks, taskActions]);

  const handleBulkStatusChange = useCallback((status: string) => {
    if (selectedTasks.size === 0) return;
    taskActions.handleBatchUpdateTasks(
      [...selectedTasks].map(id => ({ id, updates: { status: status as import('./types').TaskStatus } }))
    );
    setSelectedTasks(new Set());
    setSelectMode(false);
  }, [selectedTasks, taskActions]);

  const handleExitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedTasks(new Set());
  }, []);

  const handleRemoveActivity = useCallback((id: string) => {
    if (!data) return;
    snapshotBeforeAction('Activity removed');
    const newActivity = activity.filter(a => a.id !== id);
    if (data) save({ ...data, activity: newActivity });
  }, [activity, data, save, snapshotBeforeAction]);

  const handleNavigateToTask = useCallback((taskId: number) => {
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
  }, [setProductTab]);

  const actions = useMemo(() => ({
    // Task actions
    handleUpdateTask: taskActions.handleUpdateTask,
    handleBatchUpdateTasks: taskActions.handleBatchUpdateTasks,
    handleUpdateNotes: taskActions.handleUpdateNotes,
    handleAddTask: taskActions.handleAddTask,
    handleRenameGroup: taskActions.handleRenameGroup,
    handleDeleteGroup: taskActions.handleDeleteGroup,
    handleUpdateEpics: taskActions.handleUpdateEpics,
    handleDeleteTask,
    handleAddAttachment: taskActions.handleAddAttachment,
    handleDeleteAttachment: taskActions.handleDeleteAttachment,
    // Queue actions
    handleQueue: queueActions.handleQueue,
    handleQueueAll: queueActions.handleQueueAll,
    handleQueueGroup: queueActions.handleQueueGroup,
    handleRemoveFromQueue: queueActions.handleRemoveFromQueue,
    handleClearQueue: queueActions.handleClearQueue,
    handleLaunchTask: queueActions.handleLaunchTask,
    handleLaunchPhase: queueActions.handleLaunchPhase,
    handleRetryFailed: queueActions.handleRetryFailed,
    handleLaunchTerminal: queueActions.handleLaunchTerminal,
    handleArrange: queueActions.handleArrange,
    launchedIds: queueActions.launchedIds,
    launchMode: queueActions.launchMode,
    setLaunchMode: queueActions.setLaunchMode,
    arranging: queueActions.arranging,
    setArranging: queueActions.setArranging,
    // Project actions
    pauseTask,
    cancelTask,
    // Selection
    selectedTask,
    handleSelectTask,
    handleNavigateToTask,
    glowTaskId,
    // Multi-select / bulk actions
    selectMode,
    selectedTasks,
    onToggleSelectMode: () => {
      if (selectMode) handleExitSelectMode();
      else { setSelectMode(true); setSelectedTask(null); }
    },
    onToggleTaskSelection: handleToggleTaskSelection,
    onBulkDelete: handleBulkDelete,
    onBulkStatusChange: handleBulkStatusChange,
    onExitSelectMode: handleExitSelectMode,
    // Activity
    handleRemoveActivity,
    // Config
    defaultEngine: data?.defaultEngine,
  }), [taskActions, queueActions, pauseTask, cancelTask, selectedTask, handleSelectTask, handleNavigateToTask, glowTaskId, handleDeleteTask, handleRemoveActivity, data?.defaultEngine, selectMode, selectedTasks, handleToggleTaskSelection, handleBulkDelete, handleBulkStatusChange, handleExitSelectMode]);

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

  const selectedTaskData = tasks.find(t => t.id === selectedTask) || null;

  return (
    <ActionProvider value={actions}>
    <div className="min-h-screen flex-col">
      <Header projectName={projectName} status={status} projects={projects} onSwitchProject={switchProject} onOpenSkills={() => setShowSkillsConfig(true)} defaultEngine={data.defaultEngine} onSetDefaultEngine={(engineId: string) => save({ ...data, defaultEngine: engineId })} />

      <div className="dm-container">

        {/* Tab bar */}
        <div className="panel" style={{
          marginBottom: productTab === 'quality' ? 0 : undefined,
        }}>
          <SectionHeader title="" extra={
            <div className="flex w-full">
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
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
              <QualityPanel latest={quality.latest} history={quality.history} loading={quality.loading} error={quality.error} onRetry={quality.retry} healthcheckOutput={processOutput.outputs[TASK_ID_CODEHEALTH]} autofixOutput={processOutput.outputs[TASK_ID_AUTOFIX]} onClearOutput={processOutput.clearOutput} />
            </div>
          )}
        </div>

        {productTab === 'board' && (
          <>
            <div className="dm-grid-top">
              <div className="panel">
                <div className="p-16">
                  <TaskBoard
                    tasks={tasks}
                    epics={epics}
                    queue={queue}
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
                  notes={selectedTask ? (taskNotes[selectedTask] || '') : ''}
                />
              </div>
            </div>

            <div className="dm-grid-bottom">
              <div className="panel">
                <SectionHeader title="Queue" count={queue.length > 0 ? queue.length : null} />
                <CommandQueue queue={queue} tasks={tasks} processOutputs={processOutput.outputs} onClearOutput={processOutput.clearOutput} />
              </div>

              <div className="panel">
                <SectionHeader title="Activity" />
                <ActivityFeed activity={activity} tasks={tasks} />
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
      <SplitResultToast tasks={splitResult} onDismiss={() => { if (splitResultTimer.current) clearTimeout(splitResultTimer.current); setSplitResult(null); }} />

      {connected && data && (
        <FloatingScratchpad
          show={showScratchpad}
          onToggle={() => setShowScratchpad(!showScratchpad)}
          scratchpadValue={data.scratchpad || ''}
          onScratchpadChange={(text) => save({ ...data, scratchpad: text })}
          onSplit={(text) => { handleSplitTasks(text); }}
          splitting={splitting}
        />
      )}
    </div>
    </ActionProvider>
  );
}
