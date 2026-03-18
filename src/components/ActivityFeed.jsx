import React, { useMemo } from 'react';

function isCompleted(label) {
  return /completed|done/i.test(label);
}

const handleKeyActivate = (handler) => (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); }
};

export function ActivityFeed({ activity, onRemove, tasks, onNavigateToTask }) {
  const taskIds = useMemo(() => new Set((tasks || []).map(t => t.id)), [tasks]);
  const entries = useMemo(() => {
    return [...activity]
      .sort((a, b) => b.time - a.time)
      .slice(0, 15)
      .map(a => {
        const d = new Date(a.time);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const clickableTaskId = a.taskId != null && taskIds.has(a.taskId) ? a.taskId : null;
        return {
          key: a.id,
          label: a.label,
          completed: isCompleted(a.label),
          commitRef: a.commitRef || null,
          filesChanged: a.filesChanged || null,
          clickableTaskId,
          isToday,
          date: isToday
            ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        };
      });
  }, [activity, taskIds]);

  if (entries.length === 0) {
    return (
      <div style={{
        padding: '20px 16px', textAlign: 'center', color: 'var(--dm-text-light)', fontSize: '12px',
      }}>
        No activity yet
      </div>
    );
  }

  return (
    <div style={{ padding: '2px 0' }}>
      {entries.map(e => (
        <div
          key={e.key}
          className={'activity-row' + (e.clickableTaskId != null ? ' activity-clickable' : '')}
          role={e.clickableTaskId != null ? 'button' : undefined}
          tabIndex={e.clickableTaskId != null ? 0 : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '5px 14px',
            opacity: e.isToday ? 1 : 0.6,
          }}
          onClick={e.clickableTaskId != null ? () => onNavigateToTask(e.clickableTaskId) : undefined}
          onKeyDown={e.clickableTaskId != null ? handleKeyActivate(() => onNavigateToTask(e.clickableTaskId)) : undefined}
        >
          {/* Colored dot */}
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: e.completed ? 'var(--dm-success)' : 'var(--dm-border)',
          }} />

          {/* Label */}
          <span className="activity-label" style={{
            flex: 1, fontSize: '12px', color: e.clickableTaskId != null ? 'var(--dm-accent)' : 'var(--dm-text)',
            fontWeight: e.isToday ? 500 : 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{e.label}</span>

          {/* Metadata */}
          {e.commitRef ? (
            <span style={{
              fontFamily: 'monospace', fontSize: '10px', fontWeight: 600,
              background: 'var(--dm-accent-light)', color: 'var(--dm-accent)',
              padding: '0 5px', borderRadius: '3px', flexShrink: 0,
            }}>{e.commitRef}</span>
          ) : null}

          {/* Timestamp */}
          <span style={{
            fontSize: '10px', color: 'var(--dm-text-light)',
            flexShrink: 0, minWidth: '36px', textAlign: 'right',
          }}>{e.date}</span>

          {/* Remove */}
          <button
            onClick={(ev) => { ev.stopPropagation(); onRemove(e.key); }}
            aria-label="Remove activity"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--dm-text-light)', fontSize: '11px', padding: '0 2px',
              lineHeight: 1, opacity: 0, transition: 'opacity 0.15s',
            }}
            className="activity-remove"
            title="Remove"
          >×</button>
        </div>
      ))}
    </div>
  );
}
