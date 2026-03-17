import React, { useState, useMemo, useEffect } from 'react';
import { CardForm } from './CardForm.jsx';
import { EPIC_PALETTE, PAUSED_COLOR } from '../constants/colors.js';
import { hashString } from '../utils/hash.js';
import { STATUS } from '../constants/statuses.js';

export function TaskBoard({ tasks, selectedTask, onSelectTask, onAddTask, onQueueAll, onQueueGroup, onArrange, queue, onPauseTask, onCancelTask, onRenameGroup, epics, onUpdateEpics, glowTaskId }) {
  const [editingGroup, setEditingGroup] = useState(null);
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
    const map = {};
    const usedIndices = new Set();
    // First pass: registered epics with stored color
    (epics || []).forEach(e => {
      const idx = (e.color != null ? e.color : hashString(e.name)) % EPIC_PALETTE.length;
      usedIndices.add(idx);
      map[e.name] = EPIC_PALETTE[idx];
    });
    // Second pass: unregistered groups get hash-based color (avoid collisions)
    allGroups.forEach(g => {
      if (map[g]) return;
      let idx = hashString(g) % EPIC_PALETTE.length;
      let attempts = 0;
      while (usedIndices.has(idx) && attempts < EPIC_PALETTE.length) { idx = (idx + 1) % EPIC_PALETTE.length; attempts++; }
      usedIndices.add(idx);
      map[g] = EPIC_PALETTE[idx];
      // Auto-register this epic
      if (onUpdateEpics && epics) {
        const newEpics = [...epics, { name: g, color: idx }];
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

  const isWaiting = (task) => {
    const p = (task.progress || '').toLowerCase();
    return /waiting|approval|planning/.test(p);
  };

  const getCardStyle = (task) => {
    const isSelected = selectedTask === task.id;
    const base = {
      background: 'var(--dm-surface)',
      borderRadius: 'var(--dm-radius-sm)', padding: '12px 16px',
      cursor: 'pointer', transition: 'all 0.15s',
      minWidth: '160px', flex: '1 1 160px', maxWidth: '260px',
    };
    if (task.status === STATUS.IN_PROGRESS) {
      const waiting = isWaiting(task);
      const color = waiting ? 'var(--dm-amber)' : 'var(--dm-accent)';
      return {
        ...base,
        border: '2px solid ' + color,
        boxShadow: isSelected ? '0 2px 8px ' + (waiting ? 'var(--dm-amber-shadow)' : 'var(--dm-accent-shadow)') : 'var(--dm-shadow-sm)',
      };
    }
    if (task.status === STATUS.DONE) {
      return {
        ...base,
        border: isSelected ? '2px solid var(--dm-success)' : '1px solid var(--dm-success)',
        boxShadow: isSelected ? '0 2px 8px var(--dm-success-shadow)' : 'var(--dm-shadow-sm)',
        opacity: 0.75,
      };
    }
    if (task.status === STATUS.PAUSED) {
      return {
        ...base,
        border: isSelected ? '2px solid ' + PAUSED_COLOR : '1px dashed ' + PAUSED_COLOR,
        boxShadow: isSelected ? '0 2px 8px var(--dm-paused-shadow)' : 'var(--dm-shadow-sm)',
        opacity: 0.85,
      };
    }
    if (task.status === STATUS.BLOCKED) {
      return {
        ...base,
        border: isSelected ? '2px solid var(--dm-text-light)' : '1px solid var(--dm-border)',
        boxShadow: isSelected ? '0 2px 8px var(--dm-dark-shadow)' : 'var(--dm-shadow-sm)',
        opacity: 0.6,
      };
    }
    if (task.status === STATUS.BACKLOG) {
      return {
        ...base,
        border: isSelected ? '2px solid var(--dm-text-light)' : '1px dashed var(--dm-border)',
        boxShadow: isSelected ? '0 2px 8px var(--dm-dark-shadow)' : 'var(--dm-shadow-sm)',
        opacity: 0.6,
      };
    }
    // pending (default)
    return {
      ...base,
      border: isSelected ? '2px solid var(--dm-accent)' : '1px solid var(--dm-border)',
      boxShadow: isSelected ? '0 2px 8px var(--dm-accent-shadow)' : 'var(--dm-shadow-sm)',
    };
  };

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

  const renderTaskCard = (task) => (
            <div
              key={task.id}
              data-task-id={task.id}
              onClick={() => onSelectTask(task.id)}
              className={(task.status === STATUS.IN_PROGRESS ? 'task-card-in-progress' : '') + (glowTaskId === task.id ? ' task-card-glow' : '') || undefined}
              style={getCardStyle(task)}
              onMouseOver={e => e.currentTarget.style.boxShadow = 'var(--dm-shadow-md)'}
              onMouseOut={e => e.currentTarget.style.boxShadow = selectedTask === task.id ? '0 2px 8px var(--dm-accent-shadow)' : 'var(--dm-shadow-sm)'}
            >
              <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {task.manual ? <span title="Manual task" style={{
                  fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
                  background: 'var(--dm-border)', color: 'var(--dm-text-light)', letterSpacing: '0.03em',
                }}>YOU</span> : null}
                {task.name}
              </div>
              {task.dependsOn && task.dependsOn.length > 0 ? (
                <div style={{ fontSize: '10px', color: 'var(--dm-text-light)', fontStyle: 'italic', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  after: {task.dependsOn.map(depId => {
                    const dep = tasks.find(t => t.id === depId);
                    return dep ? dep.name : '?';
                  }).join(', ')}
                </div>
              ) : null}
              {task.status === STATUS.BLOCKED && task.blockedReason ? (
                <div style={{ fontSize: '11px', color: 'var(--dm-text-light)', marginTop: '4px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Blocked: {task.blockedReason.length > 50 ? task.blockedReason.slice(0, 50) + '...' : task.blockedReason}
                </div>
              ) : null}
              {task.status === STATUS.IN_PROGRESS && task.progress ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  <div className="progress-text-shimmer" style={{ fontSize: '11px', color: isWaiting(task) ? 'var(--dm-amber)' : 'var(--dm-accent)', lineHeight: 1.3, flex: 1 }}>
                    {task.progress}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onPauseTask(task.id); }}
                    title="Pause — save progress, resume later"
                    style={{
                      padding: '1px 6px', background: 'none', border: '1px solid var(--dm-border)',
                      borderRadius: '3px', cursor: 'pointer', color: 'var(--dm-text-light)',
                      fontSize: '10px', fontFamily: 'var(--dm-font)', lineHeight: 1.4,
                      flexShrink: 0, transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.target.style.borderColor = PAUSED_COLOR; e.target.style.color = PAUSED_COLOR; }}
                    onMouseOut={e => { e.target.style.borderColor = 'var(--dm-border)'; e.target.style.color = 'var(--dm-text-light)'; }}
                  >&#9646;&#9646;</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onCancelTask(task.id); }}
                    title="Cancel — discard progress, reset to pending"
                    style={{
                      padding: '1px 6px', background: 'none', border: '1px solid var(--dm-border)',
                      borderRadius: '3px', cursor: 'pointer', color: 'var(--dm-text-light)',
                      fontSize: '10px', fontFamily: 'var(--dm-font)', lineHeight: 1.4,
                      flexShrink: 0, transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.target.style.borderColor = 'var(--dm-danger)'; e.target.style.color = 'var(--dm-danger)'; }}
                    onMouseOut={e => { e.target.style.borderColor = 'var(--dm-border)'; e.target.style.color = 'var(--dm-text-light)'; }}
                  >&#10005;</button>
                </div>
              ) : null}
              {task.status === STATUS.PAUSED ? (
                <div style={{ fontSize: '11px', color: PAUSED_COLOR, marginTop: '4px', lineHeight: 1.3 }}>
                  {task.lastProgress || 'Paused'}
                  {task.branch ? (
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', opacity: 0.7, marginTop: '2px' }}>{task.branch}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
  );

  const handleBoardClick = (e) => {
    // Deselect when clicking empty space — ignore if click was inside a card, button, or input
    if (e.target.closest('[data-task-id], button, input, select, textarea, a')) return;
    onSelectTask(null);
  };

  return (
    <div onClick={handleBoardClick}>
      <div style={{ marginBottom: '16px' }}>
        {epicStats.length > 0 ? (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
            {epicStats.map(ep => {
              const colors = epicColors[ep.name] || {};
              const pct = ep.total > 0 ? (ep.done / ep.total) * 100 : 0;
              return (
                <div key={ep.name} style={{
                  padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
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
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--dm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          Up next
        </div>
        {pendingTasks.length >= 2 ? (() => {
          const statusFilters = [
            { label: 'All', value: 'all' },
            { label: 'Pending', value: STATUS.PENDING },
            { label: 'In Progress', value: STATUS.IN_PROGRESS },
            { label: 'Blocked', value: STATUS.BLOCKED },
            { label: 'Paused', value: STATUS.PAUSED },
          ];
          const statusCounts = {};
          for (const t of pendingTasks) {
            statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
          }
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {statusFilters.filter(f => f.value === 'all' || statusCounts[f.value]).map(f => {
                  const isActive = activeFilter === f.value;
                  const count = f.value === 'all' ? pendingTasks.length : (statusCounts[f.value] || 0);
                  return (
                    <button
                      key={f.value}
                      onClick={() => setActiveFilter(f.value)}
                      style={{
                        fontSize: '11px', padding: '3px 10px', borderRadius: '12px',
                        cursor: 'pointer', fontFamily: 'var(--dm-font)', fontWeight: 500,
                        transition: 'all 0.15s', border: isActive ? '1px solid var(--dm-accent)' : '1px solid var(--dm-border)',
                        background: isActive ? 'var(--dm-accent)' : 'transparent',
                        color: isActive ? 'white' : 'var(--dm-text-light)',
                      }}
                    >
                      {f.label} {count}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchText}
                onInput={e => setSearchText(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                style={{
                  fontSize: '12px', padding: '4px 10px',
                  border: searchFocused ? '1px solid var(--dm-accent)' : '1px solid var(--dm-border)',
                  borderRadius: '12px', background: 'var(--dm-bg)', color: 'var(--dm-text)',
                  outline: 'none', fontFamily: 'var(--dm-font)', width: '160px',
                }}
              />
            </div>
          );
        })() : null}
        {[...pendingGroups.entries()].map(([groupName, groupTasks]) => (
          <div key={groupName || '__ungrouped'} style={{ marginBottom: groupName ? '12px' : '0' }}>
            {groupName ? (
              editingGroup === groupName ? (
                <input
                  value={editGroupName}
                  onInput={e => setEditGroupName(e.target.value)}
                  onBlur={() => {
                    const trimmed = editGroupName.trim();
                    if (trimmed && trimmed !== groupName && onRenameGroup) onRenameGroup(groupName, trimmed);
                    setEditingGroup(null);
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingGroup(null); }}
                  autoFocus
                  style={{
                    fontSize: '10px', fontWeight: 600, color: 'var(--dm-text-light)', marginBottom: '6px',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    background: 'var(--dm-bg)', border: '1px solid var(--dm-accent)', borderRadius: '3px',
                    padding: '2px 6px', outline: 'none', fontFamily: 'var(--dm-font)',
                  }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <div
                    onClick={() => { setEditingGroup(groupName); setEditGroupName(groupName); }}
                    title="Click to rename epic"
                    style={{
                      fontSize: '10px', fontWeight: 600, color: (epicColors[groupName] || {}).text || 'var(--dm-text-light)',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', transition: 'all 0.15s',
                      background: (epicColors[groupName] || {}).bg || 'transparent',
                      display: 'inline-block',
                    }}
                    onMouseOver={e => e.currentTarget.style.opacity = '0.7'}
                    onMouseOut={e => e.currentTarget.style.opacity = '1'}
                  >
                    {groupName}
                    {(() => {
                      const total = tasks.filter(t => t.group === groupName).length;
                      const done = tasks.filter(t => t.group === groupName && t.status === STATUS.DONE).length;
                      return (
                        <span style={{ fontSize: "9px", fontWeight: 500, color: "var(--dm-text-light)", marginLeft: "6px", letterSpacing: "normal", textTransform: "none" }}>
                          {done}/{total}
                        </span>
                      );
                    })()}
                  </div>
                  {onQueueGroup && (() => {
                    const unqueued = groupTasks.filter(t => (t.status === STATUS.PENDING || t.status === STATUS.PAUSED) && !(queue || []).some(q => q.task === t.id));
                    if (unqueued.length === 0) return null;
                    return (
                      <button
                        onClick={() => onQueueGroup(groupName)}
                        title={'Queue ' + unqueued.length + ' task(s) from ' + groupName}
                        style={{
                          fontSize: '9px', fontWeight: 600, padding: '1px 8px', borderRadius: '10px',
                          cursor: 'pointer', fontFamily: 'var(--dm-font)',
                          border: '1px solid var(--dm-accent)', background: 'none', color: 'var(--dm-accent)',
                          transition: 'all 0.15s', textTransform: 'none', letterSpacing: 'normal',
                        }}
                        onMouseOver={e => { e.target.style.background = 'var(--dm-accent)'; e.target.style.color = 'white'; }}
                        onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--dm-accent)'; }}
                      >Queue {unqueued.length}</button>
                    );
                  })()}
                </div>
              )
            ) : null}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {groupTasks.map(renderTaskCard)}
            </div>
          </div>
        ))}
        {pendingTasks.length === 0 && !showNewForm ? (
          <div style={{
            padding: '20px', textAlign: 'center', color: 'var(--dm-text-light)', fontSize: '13px',
            width: '100%',
          }}>
            No tasks yet
          </div>
        ) : null}
        {pendingTasks.length > 0 && filteredPendingTasks.length === 0 && !showNewForm ? (
          <div style={{
            padding: '20px', textAlign: 'center', color: 'var(--dm-text-light)', fontSize: '13px',
            width: '100%',
          }}>
            No matching tasks
          </div>
        ) : null}
        {!showNewForm ? (
          <div
            onClick={() => setShowNewForm(true)}
            style={{
              border: '2px dashed var(--dm-border)',
              borderRadius: 'var(--dm-radius-sm)', padding: '12px 16px',
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--dm-text-light)', fontSize: '13px', fontWeight: 500,
              marginTop: '8px',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--dm-accent)'; e.currentTarget.style.color = 'var(--dm-accent)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--dm-border)'; e.currentTarget.style.color = 'var(--dm-text-light)'; }}
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
              style={{
                padding: '5px 14px', background: 'none',
                color: 'var(--dm-amber)', border: '1px solid var(--dm-amber)',
                borderRadius: 'var(--dm-radius-sm)', fontSize: '12px',
                fontWeight: 600, fontFamily: 'var(--dm-font)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.target.style.background = 'var(--dm-amber)'; e.target.style.color = 'white'; }}
              onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--dm-amber)'; }}
            >
              Arrange tasks
            </button>
            {(() => {
              const pendingNotQueued = tasks.filter(t => (t.status === STATUS.PENDING || t.status === STATUS.PAUSED) && !(queue || []).some(q => q.task === t.id));
              if (pendingNotQueued.length === 0) return null;
              return (
                <button
                  onClick={onQueueAll}
                  style={{
                    padding: '5px 14px', background: 'none',
                    color: 'var(--dm-accent)', border: '1px solid var(--dm-accent)',
                    borderRadius: 'var(--dm-radius-sm)', fontSize: '12px',
                    fontWeight: 600, fontFamily: 'var(--dm-font)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { e.target.style.background = 'var(--dm-accent)'; e.target.style.color = 'white'; }}
                  onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--dm-accent)'; }}
                >
                  Queue all ({pendingNotQueued.length})
                </button>
              );
            })()}
          </div>
        ) : null}
      </div>

      {backlogTasks.length > 0 ? (
        <div>
          <div
            onClick={() => setShowBacklog(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              padding: '8px 0', userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--dm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Backlog
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--dm-text-light)',
            }}>{backlogTasks.length}</span>
            <span style={{ fontSize: '11px', color: 'var(--dm-text-light)', transform: showBacklog ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>&#9660;</span>
          </div>
          {showBacklog ? (
            <div style={{ paddingTop: '4px' }}>
              {[...backlogGroups.entries()].map(([groupName, groupTasks]) => (
                <div key={groupName} style={{ marginBottom: '8px' }}>
                  <div style={{
                    fontSize: '10px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em',
                    color: (epicColors[groupName] || {}).text || 'var(--dm-text-light)', opacity: 0.6,
                    display: 'inline-block', padding: '1px 5px', borderRadius: '3px',
                    background: (epicColors[groupName] || {}).bg || 'transparent',
                  }}>
                    {groupName}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {groupTasks.map(renderTaskCard)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {doneTasks.length > 0 ? (
        <div>
          <div
            onClick={() => setShowCompleted(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              padding: '8px 0', userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--dm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Done
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--dm-text-light)',
            }}>{doneTasks.length}</span>
            <span style={{ fontSize: '11px', color: 'var(--dm-text-light)', transform: showCompleted ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>&#9660;</span>
          </div>
          {showCompleted ? (
            <div style={{ paddingTop: '4px' }}>
              {[...doneGroups.entries()].map(([groupName, groupTasks]) => (
                <div key={groupName} style={{ marginBottom: '8px' }}>
                  <div style={{
                    fontSize: '10px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em',
                    color: (epicColors[groupName] || {}).text || 'var(--dm-text-light)', opacity: 0.6,
                    display: 'inline-block', padding: '1px 5px', borderRadius: '3px',
                    background: (epicColors[groupName] || {}).bg || 'transparent',
                  }}>
                    {groupName}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {groupTasks.map(t => (
                      <div key={t.id} data-task-id={t.id} onClick={() => onSelectTask(t.id)} style={{
                        border: selectedTask === t.id ? '1px solid var(--dm-text-light)' : '1px solid var(--dm-border)',
                        borderRadius: 'var(--dm-radius-sm)', padding: '5px 10px',
                        cursor: 'pointer', transition: 'all 0.15s', opacity: 0.75,
                      }}
                      className={glowTaskId === t.id ? 'task-card-glow' : undefined}
                      >
                        <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--dm-text-light)' }}>{t.name}</span>
                        {t.commitRef ? (
                          <span style={{
                            fontFamily: 'monospace', fontSize: '9px', fontWeight: 600,
                            background: 'var(--dm-accent-light)', color: 'var(--dm-accent)',
                            padding: '0 4px', borderRadius: '3px', marginLeft: '5px',
                          }}>{t.commitRef}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
