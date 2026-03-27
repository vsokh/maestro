import React, { useState, useMemo, useEffect } from 'react';
import { CardForm } from './CardForm.tsx';
import { EPIC_PALETTE } from '../constants/colors.ts';
import { hashString } from '../utils/hash.ts';
import { STATUS } from '../constants/statuses.ts';
import { StatusFilter } from './board/StatusFilter.tsx';
import { EpicGroup } from './board/EpicGroup.tsx';
import { DoneSection } from './board/DoneSection.tsx';
import {
  BOARD_UP_NEXT, BOARD_NO_TASKS, BOARD_NO_MATCHING, BOARD_ADD_TASK, BOARD_ARRANGE,
} from '../constants/strings.ts';
import { getActiveTasks, getDoneTasks, getBacklogTasks, getAllGroups, getEpicColors, getEpicStats, groupTasksBy, getUnqueuedTasks, getActiveCountForGroup } from '../utils/taskFilters.ts';
import type { Task, QueueItem, Epic, EpicColor } from '../types';

const handleKeyActivate = (handler: (e: React.KeyboardEvent<HTMLElement>) => void) => (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); }
};

interface TaskBoardProps {
  tasks: Task[];
  selectedTask: number | null;
  onSelectTask: (id: number | null) => void;
  onAddTask: (task: Partial<Task>) => void;
  onQueueAll: () => void;
  onQueueGroup: (group: string) => void;
  onArrange: () => void;
  arranging?: boolean;
  queue: QueueItem[];
  onPauseTask: (id: number) => void;
  onCancelTask: (id: number) => void;
  onRenameGroup: (oldName: string, newName: string) => void;
  onDeleteGroup: (groupName: string) => void;
  epics: Epic[];
  onUpdateEpics: (epics: Epic[]) => void;
  glowTaskId: number | null;
}

export function TaskBoard({ tasks, selectedTask, onSelectTask, onAddTask, onQueueAll, onQueueGroup, onArrange, arranging, queue, onPauseTask, onCancelTask, onRenameGroup, onDeleteGroup, epics, onUpdateEpics, glowTaskId }: TaskBoardProps) {
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchFocused, setSearchFocused] = useState(false);
  const { pendingTasks, backlogTasks, doneTasks } = useMemo(() => ({
    pendingTasks: getActiveTasks(tasks),
    backlogTasks: getBacklogTasks(tasks),
    doneTasks: getDoneTasks(tasks),
  }), [tasks]);
  const allGroups = useMemo(() => getAllGroups(tasks), [tasks]);
  // Derive colors from epics registry (stable), fallback to hash for unregistered
  const epicColors = useMemo(() => getEpicColors(epics || [], allGroups), [allGroups, epics]);
  // Auto-register unregistered groups as epics
  useEffect(() => {
    if (!onUpdateEpics || !epics) return;
    const registeredNames = new Set(epics.map(e => e.name));
    const usedIndices = new Set(epics.map(e => (e.color != null ? e.color : hashString(e.name)) % EPIC_PALETTE.length));
    const newEpics: Epic[] = [];
    allGroups.forEach(g => {
      if (!g || registeredNames.has(g)) return;
      let idx = hashString(g) % EPIC_PALETTE.length;
      let attempts = 0;
      while (usedIndices.has(idx) && attempts < EPIC_PALETTE.length) { idx = (idx + 1) % EPIC_PALETTE.length; attempts++; }
      usedIndices.add(idx);
      newEpics.push({ name: g, color: idx });
    });
    if (newEpics.length > 0) {
      onUpdateEpics([...epics, ...newEpics]);
    }
  }, [allGroups, epics, onUpdateEpics]);  // NOTE: keeps EPIC_PALETTE + hashString for index computation
  // All epic names for autocomplete (from registry, which includes auto-registered ones)
  const epicNames = (epics || []).map(e => e.name);
  const hiddenEpicNames = useMemo(() => {
    return new Set((epics || []).filter(e => e.hidden).map(e => e.name));
  }, [epics]);
  const handleToggleEpicVisibility = (epicName: string) => {
    const updated = (epics || []).map(e =>
      e.name === epicName ? { ...e, hidden: !e.hidden } : e
    );
    onUpdateEpics(updated);
  };
  const filteredPendingTasks = useMemo(() => {
    let filtered = pendingTasks;
    if (activeFilter !== 'all') {
      filtered = filtered.filter(t => t.status === activeFilter);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      filtered = filtered.filter(t => t.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [pendingTasks, activeFilter, searchText]);
  const pendingGroups = useMemo(() => groupTasksBy(filteredPendingTasks, { hiddenEpics: hiddenEpicNames }), [filteredPendingTasks, hiddenEpicNames]);
  const { doneGroups, backlogGroups } = useMemo(() => ({
    doneGroups: groupTasksBy(doneTasks, { defaultGroup: 'Other' }),
    backlogGroups: groupTasksBy(backlogTasks, { defaultGroup: 'Other' }),
  }), [doneTasks, backlogTasks]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showBacklog, setShowBacklog] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // Auto-expand Done/Backlog when a task in that section is selected (e.g. from Activity feed)
  const [prevSelectedTask, setPrevSelectedTask] = useState<number | null>(null);
  if (selectedTask !== prevSelectedTask) {
    setPrevSelectedTask(selectedTask);
    if (selectedTask) {
      const selTask = tasks.find(t => t.id === selectedTask);
      if (selTask?.status === STATUS.DONE && !showCompleted) setShowCompleted(true);
      if (selTask?.status === STATUS.BACKLOG && !showBacklog) setShowBacklog(true);
    }
  }

  // Epic progress stats across ALL tasks (not just pending)
  const epicStats = useMemo(() => getEpicStats(tasks, allGroups), [tasks, allGroups]);

  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Deselect when clicking empty space — ignore if click was inside a card, button, or input
    if ((e.target as HTMLElement).closest('[data-task-id], button, input, select, textarea, a')) return;
    onSelectTask(null);
  };

  return (
    <div onClick={handleBoardClick}>
      <div className="mb-16">
        {epicStats.length > 0 ? (
          <div className="flex-wrap gap-6" style={{ marginBottom: "14px" }}>
            {epicStats.map(ep => {
              const colors = epicColors[ep.name!] || {};
              const pct = ep.total > 0 ? (ep.done / ep.total) * 100 : 0;
              const isHidden = hiddenEpicNames.has(ep.name!);
              return (
                <div
                  key={ep.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggleEpicVisibility(ep.name!)}
                  onKeyDown={handleKeyActivate(() => handleToggleEpicVisibility(ep.name!))}
                  className="epic-progress relative overflow-hidden cursor-pointer"
                  title={isHidden ? 'Show ' + ep.name : 'Hide ' + ep.name}
                  style={{
                    padding: "4px 10px",
                    background: colors.bg || "var(--dm-bg)", color: colors.text || "var(--dm-text-light)",
                    opacity: isHidden ? 0.45 : 1,
                    transition: 'opacity 0.2s',
                    userSelect: 'none',
                  }}
                >
                  <span style={isHidden ? { textDecoration: 'line-through' } : undefined}>
                    {ep.name}
                  </span>
                  <span> {ep.done}/{ep.total}</span>
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, width: "100%", height: "3px",
                    background: colors.border || "var(--dm-border)", opacity: 0.3,
                  }} />
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, width: pct + "%", height: "3px",
                    background: colors.text || "var(--dm-accent)", transition: "width 0.3s",
                  }} />
                </div>
              );
            })}
          </div>
        ) : null}
        <div className="label" style={{ marginBottom: '10px' }}>
          {BOARD_UP_NEXT}
        </div>
        {pendingTasks.length >= 2 ? (
          <StatusFilter
            pendingTasks={pendingTasks}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            searchText={searchText}
            setSearchText={setSearchText}
            searchFocused={searchFocused}
            setSearchFocused={setSearchFocused}
          />
        ) : null}
        {[...pendingGroups.entries()].map(([groupName, groupTasks]) => (
          <EpicGroup
            key={groupName || '__ungrouped'}
            groupName={groupName}
            groupTasks={groupTasks}
            tasks={tasks}
            epicColors={epicColors}
            editingGroup={editingGroup}
            setEditingGroup={setEditingGroup}
            editGroupName={editGroupName}
            setEditGroupName={setEditGroupName}
            onRenameGroup={onRenameGroup}
            onDeleteGroup={onDeleteGroup}
            onQueueGroup={onQueueGroup}
            queue={queue}
            selectedTask={selectedTask}
            onSelectTask={onSelectTask}
            onPauseTask={onPauseTask}
            onCancelTask={onCancelTask}
            glowTaskId={glowTaskId}
          />
        ))}
        {hiddenEpicNames.size > 0 ? (
          <div className="mt-8 flex-wrap gap-6 items-center">
            <span className="text-11" style={{ color: 'var(--dm-text-light)', opacity: 0.6 }}>Hidden:</span>
            {(epics || []).filter(e => e.hidden).map(e => {
              const colors = epicColors[e.name] || {};
              const hiddenCount = getActiveCountForGroup(tasks, e.name);
              return (
                <div
                  key={e.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggleEpicVisibility(e.name)}
                  onKeyDown={handleKeyActivate(() => handleToggleEpicVisibility(e.name))}
                  className="epic-label cursor-pointer"
                  title={'Show ' + e.name}
                  style={{
                    color: colors.text || 'var(--dm-text-light)',
                    padding: '2px 6px',
                    background: colors.bg || 'transparent',
                    opacity: 0.5,
                  }}
                >
                  {e.name} ({hiddenCount})
                </div>
              );
            })}
          </div>
        ) : null}
        {pendingTasks.length === 0 && !showNewForm ? (
          <div className="empty-state p-20 w-full">
            {BOARD_NO_TASKS}
          </div>
        ) : null}
        {pendingTasks.length > 0 && filteredPendingTasks.length === 0 && !showNewForm ? (
          <div className="empty-state p-20 w-full">
            {BOARD_NO_MATCHING}
          </div>
        ) : null}
        {!showNewForm ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowNewForm(true)}
            onKeyDown={handleKeyActivate(() => setShowNewForm(true))}
            className="add-task-card inline-flex items-center justify-center mt-8"
            style={{ padding: '12px 16px' }}
          >{BOARD_ADD_TASK}</div>
        ) : null}
        {showNewForm ? (
          <div className="mt-12" style={{ maxWidth: '380px' }}>
            <CardForm
              card={null}
              groups={epicNames}
              onSave={(task) => { onAddTask(task); setShowNewForm(false); }}
              onCancel={() => setShowNewForm(false)}
            />
          </div>
        ) : null}
        {pendingTasks.length >= 1 ? (
          <div className="mt-8 flex-wrap gap-8">
            <button
              onClick={onArrange}
              disabled={arranging}
              className="btn btn-amber-outline text-12"
              style={{ padding: '5px 14px', opacity: arranging ? 0.6 : 1 }}
            >
              {arranging ? 'Arranging...' : BOARD_ARRANGE}
            </button>
            {(() => {
              const pendingNotQueued = getUnqueuedTasks(tasks, queue || []);
              if (pendingNotQueued.length === 0) return null;
              return (
                <button
                  onClick={onQueueAll}
                  className="btn btn-accent-outline text-12"
                  style={{ padding: '5px 14px' }}
                >
                  Queue all ({pendingNotQueued.length})
                </button>
              );
            })()}
          </div>
        ) : null}
      </div>

      <DoneSection
        doneTasks={doneTasks}
        backlogTasks={backlogTasks}
        doneGroups={doneGroups}
        backlogGroups={backlogGroups}
        showCompleted={showCompleted}
        setShowCompleted={setShowCompleted}
        showBacklog={showBacklog}
        setShowBacklog={setShowBacklog}
        epicColors={epicColors}
        selectedTask={selectedTask}
        onSelectTask={onSelectTask}
        glowTaskId={glowTaskId}
      />
    </div>
  );
}
