import React, { useState, useMemo } from 'react';
import { CardForm } from './CardForm.jsx';

export function TaskBoard({ tasks, features, selectedTask, onSelectTask, onAddTask, onQueueAll, onArrange, queue, onPauseTask, onCancelTask }) {
  const pendingTasks = useMemo(() => tasks.filter(t => t.status !== 'done'), [tasks]);
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

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          Up next
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {pendingTasks.map(task => (
            <div
              key={task.id}
              onClick={() => onSelectTask(task.id)}
              className={task.status === 'in-progress' ? 'task-card-in-progress' : undefined}
              style={getCardStyle(task)}
              onMouseOver={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
              onMouseOut={e => e.currentTarget.style.boxShadow = selectedTask === task.id ? '0 2px 8px rgba(106,141,190,0.2)' : 'var(--shadow-sm)'}
            >
              <div style={{ fontWeight: 600, fontSize: '13px' }}>{task.name}</div>
              {task.dependsOn && task.dependsOn.length > 0 ? (
                <div style={{ fontSize: '10px', color: 'var(--text-light)', fontStyle: 'italic', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  after: {task.dependsOn.map(depId => {
                    const dep = tasks.find(t => t.id === depId);
                    return dep ? dep.name : '?';
                  }).join(', ')}
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
          ))}
          {pendingTasks.length === 0 && !showNewForm ? (
            <div style={{
              padding: '20px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px',
              width: '100%',
            }}>
              No tasks yet
            </div>
          ) : null}
          {!showNewForm ? (
            <div
              onClick={() => setShowNewForm(true)}
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '12px 16px',
                cursor: 'pointer', transition: 'all 0.15s',
                minWidth: '160px', flex: '1 1 160px', maxWidth: '260px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-light)', fontSize: '13px', fontWeight: 500,
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-light)'; }}
            >+ Add task</div>
          ) : null}
        </div>
        {showNewForm ? (
          <div style={{ marginTop: '12px', maxWidth: '380px' }}>
            <CardForm
              card={null}
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

      {features.length > 0 ? (
        <div>
          <div
            onClick={() => setShowCompleted(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              padding: '8px 0', userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Shipped
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '20px', height: '20px', borderRadius: '50%',
              background: 'var(--success-light)', color: 'var(--success)',
              fontSize: '11px', fontWeight: 700,
            }}>{features.length}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-light)', transform: showCompleted ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
          </div>
          {showCompleted ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '4px' }}>
              {features.map(f => (
                <div key={f.id} style={{
                  background: 'var(--success-light)', border: '1px solid var(--success)',
                  borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                  minWidth: '140px', flex: '1 1 140px', maxWidth: '220px',
                }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--success)', marginBottom: '2px' }}>
                    {f.name}
                  </div>
                  {f.description ? (
                    <div style={{ fontSize: '11px', color: 'var(--success)', opacity: 0.8, lineHeight: 1.4 }}>
                      {f.description}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
