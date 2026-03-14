import React, { useState, useMemo } from 'react';
import { CardForm } from './CardForm.jsx';

const EPIC_PALETTE = [
  { bg: 'rgba(106,141,190,0.12)', text: '#6a8dbe', border: 'rgba(106,141,190,0.3)' },  // steel blue
  { bg: 'rgba(196,132,90,0.12)', text: '#c4845a', border: 'rgba(196,132,90,0.3)' },   // warm amber
  { bg: 'rgba(155,139,180,0.12)', text: '#9b8bb4', border: 'rgba(155,139,180,0.3)' },  // muted purple
  { bg: 'rgba(90,158,114,0.12)', text: '#5a9e72', border: 'rgba(90,158,114,0.3)' },    // sage green
  { bg: 'rgba(180,120,120,0.12)', text: '#b47878', border: 'rgba(180,120,120,0.3)' },  // dusty rose
  { bg: 'rgba(120,165,165,0.12)', text: '#78a5a5', border: 'rgba(120,165,165,0.3)' },  // teal
  { bg: 'rgba(170,150,100,0.12)', text: '#aa9664', border: 'rgba(170,150,100,0.3)' },  // olive gold
  { bg: 'rgba(140,130,170,0.12)', text: '#8c82aa', border: 'rgba(140,130,170,0.3)' },  // lavender
];

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function TaskBoard({ tasks, selectedTask, onSelectTask, onAddTask, onQueueAll, onArrange, queue, onPauseTask, onCancelTask, onRenameGroup, epics, onUpdateEpics }) {
  const [editingGroup, setEditingGroup] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchFocused, setSearchFocused] = useState(false);
  const pendingTasks = useMemo(() => tasks.filter(t => t.status !== 'done'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(t => t.status === 'done'), [tasks]);
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
  const [showNewForm, setShowNewForm] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const isWaiting = (task) => {
    const p = (task.progress || '').toLowerCase();
    return /waiting|approval|planning/.test(p);
  };

  const getCardStyle = (task) => {
    const isSelected = selectedTask === task.id;
    const base = {
      background: 'var(--surface)',
      borderRadius: 'var(--radius-sm)', padding: '12px 16px',
      cursor: 'pointer', transition: 'all 0.15s',
      minWidth: '160px', flex: '1 1 160px', maxWidth: '260px',
    };
    if (task.status === 'in-progress') {
      const waiting = isWaiting(task);
      const color = waiting ? 'var(--amber)' : 'var(--accent)';
      return {
        ...base,
        border: '2px solid ' + color,
        boxShadow: isSelected ? '0 2px 8px ' + (waiting ? 'rgba(196,132,90,0.25)' : 'rgba(106,141,190,0.25)') : 'var(--shadow-sm)',
      };
    }
    if (task.status === 'done') {
      return {
        ...base,
        border: isSelected ? '2px solid var(--success)' : '1px solid var(--success)',
        boxShadow: isSelected ? '0 2px 8px rgba(90,158,114,0.2)' : 'var(--shadow-sm)',
        opacity: 0.75,
      };
    }
    if (task.status === 'paused') {
      return {
        ...base,
        border: isSelected ? '2px solid #9b8bb4' : '1px dashed #9b8bb4',
        boxShadow: isSelected ? '0 2px 8px rgba(155,139,180,0.2)' : 'var(--shadow-sm)',
        opacity: 0.85,
      };
    }
    if (task.status === 'blocked') {
      return {
        ...base,
        border: isSelected ? '2px solid var(--text-light)' : '1px solid var(--border)',
        boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.1)' : 'var(--shadow-sm)',
        opacity: 0.6,
      };
    }
    // pending (default)
    return {
      ...base,
      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
      boxShadow: isSelected ? '0 2px 8px rgba(106,141,190,0.2)' : 'var(--shadow-sm)',
    };
  };

  const renderTaskCard = (task) => (
            <div
              key={task.id}
              onClick={() => onSelectTask(task.id)}
              className={task.status === 'in-progress' ? 'task-card-in-progress' : undefined}
              style={getCardStyle(task)}
              onMouseOver={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
              onMouseOut={e => e.currentTarget.style.boxShadow = selectedTask === task.id ? '0 2px 8px rgba(106,141,190,0.2)' : 'var(--shadow-sm)'}
            >
              <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {task.manual ? <span title="Manual task" style={{
                  fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
                  background: 'var(--border)', color: 'var(--text-light)', letterSpacing: '0.03em',
                }}>YOU</span> : null}
                {task.name}
              </div>
              {task.dependsOn && task.dependsOn.length > 0 ? (
                <div style={{ fontSize: '10px', color: 'var(--text-light)', fontStyle: 'italic', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  after: {task.dependsOn.map(depId => {
                    const dep = tasks.find(t => t.id === depId);
                    return dep ? dep.name : '?';
                  }).join(', ')}
                </div>
              ) : null}
              {task.status === 'blocked' && task.blockedReason ? (
                <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Blocked: {task.blockedReason.length > 50 ? task.blockedReason.slice(0, 50) + '...' : task.blockedReason}
                </div>
              ) : null}
              {task.status === 'in-progress' && task.progress ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  <div className="progress-text-shimmer" style={{ fontSize: '11px', color: isWaiting(task) ? 'var(--amber)' : 'var(--accent)', lineHeight: 1.3, flex: 1 }}>
                    {task.progress}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onPauseTask(task.id); }}
                    title="Pause — save progress, resume later"
                    style={{
                      padding: '1px 6px', background: 'none', border: '1px solid var(--border)',
                      borderRadius: '3px', cursor: 'pointer', color: 'var(--text-light)',
                      fontSize: '10px', fontFamily: 'var(--font)', lineHeight: 1.4,
                      flexShrink: 0, transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.target.style.borderColor = '#9b8bb4'; e.target.style.color = '#9b8bb4'; }}
                    onMouseOut={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-light)'; }}
                  >&#9646;&#9646;</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onCancelTask(task.id); }}
                    title="Cancel — discard progress, reset to pending"
                    style={{
                      padding: '1px 6px', background: 'none', border: '1px solid var(--border)',
                      borderRadius: '3px', cursor: 'pointer', color: 'var(--text-light)',
                      fontSize: '10px', fontFamily: 'var(--font)', lineHeight: 1.4,
                      flexShrink: 0, transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.target.style.borderColor = 'var(--danger)'; e.target.style.color = 'var(--danger)'; }}
                    onMouseOut={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-light)'; }}
                  >✕</button>
                </div>
              ) : null}
              {task.status === 'paused' ? (
                <div style={{ fontSize: '11px', color: '#9b8bb4', marginTop: '4px', lineHeight: 1.3 }}>
                  {task.lastProgress || 'Paused'}
                  {task.branch ? (
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', opacity: 0.7, marginTop: '2px' }}>{task.branch}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          Up next
        </div>
        {pendingTasks.length >= 2 ? (() => {
          const statusFilters = [
            { label: 'All', value: 'all' },
            { label: 'Pending', value: 'pending' },
            { label: 'In Progress', value: 'in-progress' },
            { label: 'Blocked', value: 'blocked' },
            { label: 'Paused', value: 'paused' },
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
                        cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 500,
                        transition: 'all 0.15s', border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: isActive ? 'var(--accent)' : 'transparent',
                        color: isActive ? 'white' : 'var(--text-light)',
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
                  border: searchFocused ? '1px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: '12px', background: 'var(--bg)', color: 'var(--text)',
                  outline: 'none', fontFamily: 'var(--font)', width: '160px',
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
                    fontSize: '10px', fontWeight: 600, color: 'var(--text-light)', marginBottom: '6px',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: '3px',
                    padding: '2px 6px', outline: 'none', fontFamily: 'var(--font)',
                  }}
                />
              ) : (
                <div
                  onClick={() => { setEditingGroup(groupName); setEditGroupName(groupName); }}
                  title="Click to rename epic"
                  style={{
                    fontSize: '10px', fontWeight: 600, color: (epicColors[groupName] || {}).text || 'var(--text-light)',
                    marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em',
                    cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', transition: 'all 0.15s',
                    background: (epicColors[groupName] || {}).bg || 'transparent',
                    display: 'inline-block',
                  }}
                  onMouseOver={e => e.target.style.opacity = '0.7'}
                  onMouseOut={e => e.target.style.opacity = '1'}
                >
                  {groupName}
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
            padding: '20px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px',
            width: '100%',
          }}>
            No tasks yet
          </div>
        ) : null}
        {pendingTasks.length > 0 && filteredPendingTasks.length === 0 && !showNewForm ? (
          <div style={{
            padding: '20px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px',
            width: '100%',
          }}>
            No matching tasks
          </div>
        ) : null}
        {!showNewForm ? (
          <div
            onClick={() => setShowNewForm(true)}
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '12px 16px',
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-light)', fontSize: '13px', fontWeight: 500,
              marginTop: '8px',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-light)'; }}
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
        {pendingTasks.length >= 2 ? (
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={onArrange}
              style={{
                padding: '5px 14px', background: 'none',
                color: 'var(--amber)', border: '1px solid var(--amber)',
                borderRadius: 'var(--radius-sm)', fontSize: '12px',
                fontWeight: 600, fontFamily: 'var(--font)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.target.style.background = 'var(--amber)'; e.target.style.color = 'white'; }}
              onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--amber)'; }}
            >
              Arrange tasks
            </button>
            {(() => {
              const pendingNotQueued = tasks.filter(t => (t.status === 'pending' || t.status === 'paused') && !(queue || []).some(q => q.task === t.id));
              if (pendingNotQueued.length === 0) return null;
              return (
                <button
                  onClick={onQueueAll}
                  style={{
                    padding: '5px 14px', background: 'none',
                    color: 'var(--accent)', border: '1px solid var(--accent)',
                    borderRadius: 'var(--radius-sm)', fontSize: '12px',
                    fontWeight: 600, fontFamily: 'var(--font)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'white'; }}
                  onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--accent)'; }}
                >
                  Queue all ({pendingNotQueued.length})
                </button>
              );
            })()}
          </div>
        ) : null}
      </div>

      {doneTasks.length > 0 ? (
        <div>
          <div
            onClick={() => setShowCompleted(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              padding: '8px 0', userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Done
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--text-light)',
            }}>{doneTasks.length}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-light)', transform: showCompleted ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
          </div>
          {showCompleted ? (
            <div style={{ paddingTop: '4px' }}>
              {[...doneGroups.entries()].map(([groupName, groupTasks]) => (
                <div key={groupName} style={{ marginBottom: '8px' }}>
                  <div style={{
                    fontSize: '10px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em',
                    color: (epicColors[groupName] || {}).text || 'var(--text-light)', opacity: 0.6,
                    display: 'inline-block', padding: '1px 5px', borderRadius: '3px',
                    background: (epicColors[groupName] || {}).bg || 'transparent',
                  }}>
                    {groupName}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {groupTasks.map(t => (
                      <div key={t.id} onClick={() => onSelectTask(t.id)} style={{
                        border: selectedTask === t.id ? '1px solid var(--text-light)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', padding: '5px 10px',
                        cursor: 'pointer', transition: 'all 0.15s', opacity: 0.75,
                      }}>
                        <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--text-light)' }}>{t.name}</span>
                        {t.commitRef ? (
                          <span style={{
                            fontFamily: 'monospace', fontSize: '9px', fontWeight: 600,
                            background: 'var(--accent-light)', color: 'var(--accent)',
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
