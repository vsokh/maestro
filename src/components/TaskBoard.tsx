import React, { useState, useMemo, useEffect } from 'react';
import { CardForm } from './CardForm.tsx';
import { EPIC_PALETTE } from '../constants/colors.ts';
import { hashString } from '../utils/hash.ts';
import { STATUS } from '../constants/statuses.ts';
import { StatusFilter } from './board/StatusFilter.tsx';
import { EpicGroup } from './board/EpicGroup.tsx';
import { DoneSection } from './board/DoneSection.tsx';
import type { Task, QueueItem, Epic } from '../types';

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
  queue: QueueItem[];
  onPauseTask: (id: number) => void;
  onCancelTask: (id: number) => void;
  onRenameGroup: (oldName: string, newName: string) => void;
  epics: Epic[];
  onUpdateEpics: (epics: Epic[]) => void;
  glowTaskId: number | null;
}

export function TaskBoard({ tasks, selectedTask, onSelectTask, onAddTask, onQueueAll, onQueueGroup, onArrange, queue, onPauseTask, onCancelTask, onRenameGroup, epics, onUpdateEpics, glowTaskId }: TaskBoardProps) {
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchFocused, setSearchFocused] = useState(false);
  const pendingTasks = useMemo(() => tasks.filter(t => t.status !== STATUS.DONE && t.status !== STATUS.BACKLOG), [tasks]);
  const backlogTasks = useMemo(() => tasks.filter(t => t.status === STATUS.BACKLOG), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(t => t.status === STATUS.DONE), [tasks]);
  const allGroups = useMemo(() => [...new Set(tasks.map(t => t.group).filter(Boolean))], [tasks]);
  // Derive colors from epics registry (stable), fallback to hash for unregistered
  const epicColors = useMemo(() => {
    const map: Record<string, any> = {};
    const usedIndices = new Set();
    // First pass: registered epics with stored color
    (epics || []).forEach(e => {
      const idx = (e.color != null ? e.color : hashString(e.name)) % EPIC_PALETTE.length;
      usedIndices.add(idx);
      map[e.name] = EPIC_PALETTE[idx];
    });
    // Second pass: unregistered groups get hash-based color (avoid collisions)
    allGroups.forEach(g => {
      if (!g || map[g]) return;
      let idx = hashString(g) % EPIC_PALETTE.length;
      let attempts = 0;
      while (usedIndices.has(idx) && attempts < EPIC_PALETTE.length) { idx = (idx + 1) % EPIC_PALETTE.length; attempts++; }
      usedIndices.add(idx);
      map[g!] = EPIC_PALETTE[idx];
      // Auto-register this epic
      if (onUpdateEpics && epics) {
        const newEpics = [...epics, { name: g!, color: idx }];
        setTimeout(() => onUpdateEpics(newEpics), 0);
      }
    });
    return map;
  }, [allGroups, epics, onUpdateEpics]);
  // All epic names for autocomplete (from registry, which includes auto-registered ones)
  const epicNames = useMemo(() => (epics || []).map(e => e.name), [epics]);
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
  const pendingGroups = useMemo(() => {
    const grouped = new Map();
    grouped.set(null, []); // ungrouped
    for (const t of filteredPendingTasks) {
      const g = t.group || null;
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g).push(t);
    }
    // Remove empty null group
    if (grouped.get(null).length === 0) grouped.delete(null);
    return grouped;
  }, [filteredPendingTasks]);
  const doneGroups = useMemo(() => {
    const grouped = new Map();
    for (const t of doneTasks) {
      const g = t.group || 'Other';
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g).push(t);
    }
    return grouped;
  }, [doneTasks]);
  const backlogGroups = useMemo(() => {
    const grouped = new Map();
    for (const t of backlogTasks) {
      const g = t.group || 'Other';
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g).push(t);
    }
    return grouped;
  }, [backlogTasks]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showBacklog, setShowBacklog] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // Auto-expand Done/Backlog when a task in that section is selected (e.g. from Activity feed)
  useEffect(() => {
    if (!selectedTask) return;
    const task = tasks.find(t => t.id === selectedTask);
    if (!task) return;
    if (task.status === STATUS.DONE && !showCompleted) setShowCompleted(true);
    if (task.status === STATUS.BACKLOG && !showBacklog) setShowBacklog(true);
  }, [selectedTask]);

  // Epic progress stats across ALL tasks (not just pending)
  const epicStats = useMemo(() => {
    const stats = [];
    for (const g of allGroups) {
      const total = tasks.filter(t => t.group === g).length;
      const done = tasks.filter(t => t.group === g && t.status === STATUS.DONE).length;
      if (total > 0) stats.push({ name: g, total, done });
    }
    return stats;
  }, [tasks, allGroups]);

  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Deselect when clicking empty space — ignore if click was inside a card, button, or input
    if ((e.target as HTMLElement).closest('[data-task-id], button, input, select, textarea, a')) return;
    onSelectTask(null);
  };

  return (
    <div onClick={handleBoardClick}>
      <div style={{ marginBottom: '16px' }}>
        {epicStats.length > 0 ? (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
            {epicStats.map(ep => {
              const colors = epicColors[ep.name!] || {};
              const pct = ep.total > 0 ? (ep.done / ep.total) * 100 : 0;
              return (
                <div key={ep.name} className="epic-progress" style={{
                  padding: "4px 10px",
                  background: colors.bg || "var(--dm-bg)", color: colors.text || "var(--dm-text-light)",
                  position: "relative", overflow: "hidden",
                }}>
                  <span>{ep.name} {ep.done}/{ep.total}</span>
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
          Up next
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
            onQueueGroup={onQueueGroup}
            queue={queue}
            selectedTask={selectedTask}
            onSelectTask={onSelectTask}
            onPauseTask={onPauseTask}
            onCancelTask={onCancelTask}
            glowTaskId={glowTaskId}
          />
        ))}
        {pendingTasks.length === 0 && !showNewForm ? (
          <div className="empty-state" style={{ padding: '20px', width: '100%' }}>
            No tasks yet
          </div>
        ) : null}
        {pendingTasks.length > 0 && filteredPendingTasks.length === 0 && !showNewForm ? (
          <div className="empty-state" style={{ padding: '20px', width: '100%' }}>
            No matching tasks
          </div>
        ) : null}
        {!showNewForm ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowNewForm(true)}
            onKeyDown={handleKeyActivate(() => setShowNewForm(true))}
            className="add-task-card"
            style={{
              padding: '12px 16px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginTop: '8px',
            }}
          >+ Add task</div>
        ) : null}
        {showNewForm ? (
          <div style={{ marginTop: '12px', maxWidth: '380px' }}>
            <CardForm
              card={null}
              groups={epicNames}
              onSave={(task) => { onAddTask(task); setShowNewForm(false); }}
              onCancel={() => setShowNewForm(false)}
            />
          </div>
        ) : null}
        {pendingTasks.length >= 1 ? (
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={onArrange}
              className="btn btn-amber-outline"
              style={{ padding: '5px 14px', fontSize: '12px' }}
            >
              Arrange tasks
            </button>
            {(() => {
              const pendingNotQueued = tasks.filter(t => (t.status === STATUS.PENDING || t.status === STATUS.PAUSED) && !(queue || []).some(q => q.task === t.id));
              if (pendingNotQueued.length === 0) return null;
              return (
                <button
                  onClick={onQueueAll}
                  className="btn btn-accent-outline"
                  style={{ padding: '5px 14px', fontSize: '12px' }}
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
