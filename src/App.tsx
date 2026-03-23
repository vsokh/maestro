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
import { useProcessOutput } from './hooks/useProcessOutput.ts';
import { Scratchpad } from './components/Scratchpad.tsx';
import { api } from './api.ts';
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
  const [splitting, setSplitting] = useState(false);
  const [showScratchpad, setShowScratchpad] = useState(false);

  const handleSplitTasks = useCallback(async (text: string) => {
    if (!data) return;
    setSplitting(true);
    try {
      const result = await api.splitTasks(text);
      if (result.tasks && result.tasks.length > 0) {
        const maxId = Math.max(0, ...data.tasks.map(t => t.id));
        const newTasks = result.tasks.map((t, i) => ({
          id: maxId + i + 1,
          name: t.name,
          fullName: t.fullName || t.name,
          description: t.description || '',
          status: 'pending' as const,
          group: t.group || undefined,
          createdAt: new Date().toISOString(),
        }));
        // Add new epics if needed
        const existingEpics = new Set((data.epics || []).map(e => e.name));
        const newEpics = [...(data.epics || [])];
        for (const t of newTasks) {
          if (t.group && !existingEpics.has(t.group)) {
            newEpics.push({ name: t.group, color: newEpics.length });
            existingEpics.add(t.group);
          }
        }
        const activity = [
          { id: 'act_split_' + Date.now(), time: Date.now(), label: `${newTasks.length} tasks created from scratchpad` },
          ...(data.activity || []),
        ];
        save({ ...data, tasks: [...data.tasks, ...newTasks], epics: newEpics, activity, scratchpad: '' });

        // Auto-arrange after split
        try {
          await api.launch(0, '/orchestrator arrange');
        } catch { /* arrange is best-effort */ }
      }
    } catch (err: any) {
      showError('Failed to split tasks: ' + (err?.message || 'unknown'));
    } finally {
      setSplitting(false);
    }
  }, [data, save, showError]);
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
  }, [data?.activity, queueActions.arranging]);

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
                    arranging={queueActions.arranging}
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
                <CommandQueue queue={queue} tasks={tasks} onLaunch={queueActions.handleLaunchTask} onLaunchTerminal={queueActions.handleLaunchTerminal} onLaunchPhase={queueActions.handleLaunchPhase} onRemove={queueActions.handleRemoveFromQueue} onClear={queueActions.handleClearQueue} onQueueAll={queueActions.handleQueueAll} onPauseTask={pauseTask} onUpdateTask={taskActions.handleUpdateTask} onBatchUpdateTasks={taskActions.handleBatchUpdateTasks} launchedIds={queueActions.launchedIds} defaultEngine={data.defaultEngine} processOutputs={processOutput.outputs} onClearOutput={processOutput.clearOutput} />
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

      {/* Floating scratchpad */}
      {connected && data && (
        <>
          <button
            onClick={() => setShowScratchpad(!showScratchpad)}
            title="Scratchpad"
            style={{
              position: 'fixed', bottom: '24px', right: '24px', zIndex: 50,
              width: '48px', height: '48px', borderRadius: '50%',
              background: data.scratchpad ? 'var(--dm-amber)' : 'var(--dm-accent)',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: '20px', lineHeight: 1,
              boxShadow: 'var(--dm-shadow-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.2s',
              transform: showScratchpad ? 'rotate(45deg)' : 'none',
            }}
          >{showScratchpad ? '+' : '\u270E'}</button>

          {showScratchpad && (
            <div style={{
              position: 'fixed', bottom: '84px', right: '24px', zIndex: 50,
              width: '400px', height: '60vh',
              background: 'var(--dm-surface)',
              border: '1px solid var(--dm-border)',
              borderRadius: 'var(--dm-radius)',
              boxShadow: 'var(--dm-shadow-md)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--dm-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--dm-text)' }}>Scratchpad</span>
                <button onClick={() => setShowScratchpad(false)} className="btn-ghost" style={{ fontSize: '16px', padding: '2px 6px' }}>×</button>
              </div>
              <div style={{ padding: '12px 14px', flex: 1, overflow: 'auto' }}>
                <Scratchpad
                  value={data.scratchpad || ''}
                  onChange={(text) => save({ ...data, scratchpad: text })}
                  onSplit={(text) => { handleSplitTasks(text); setShowScratchpad(false); }}
                  splitting={splitting}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
