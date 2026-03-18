import type { Activity, Task } from '../types';
import React, { useMemo } from 'react';

function isCompleted(label: string) {
  return /completed|done/i.test(label);
}

const handleKeyActivate = (handler: (e: any) => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); }
};

interface ActivityFeedProps {
  activity: Activity[];
  onRemove: (id: string) => void;
  tasks: Task[];
  onNavigateToTask: (taskId: number) => void;
}

export function ActivityFeed({ activity, onRemove, tasks, onNavigateToTask }: ActivityFeedProps) {
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
      <div className="empty-state-sm" style={{ padding: '20px 16px' }}>
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
          onClick={e.clickableTaskId != null ? () => onNavigateToTask(e.clickableTaskId!) : undefined}
          onKeyDown={e.clickableTaskId != null ? handleKeyActivate(() => onNavigateToTask(e.clickableTaskId!)) : undefined}
        >
          {/* Colored dot */}
          <span className={`activity-dot ${e.completed ? 'activity-dot--completed' : 'activity-dot--default'}`} style={{
            width: 6, height: 6, flexShrink: 0,
          }} />

          {/* Label */}
          <span className="activity-label" style={{
            flex: 1, fontSize: '12px',
            color: e.clickableTaskId != null ? 'var(--dm-accent)' : 'var(--dm-text)',
            fontWeight: e.isToday ? 500 : 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{e.label}</span>

          {/* Metadata */}
          {e.commitRef ? (
            <span className="commit-ref" style={{
              padding: '0 5px', flexShrink: 0, fontSize: '10px',
            }}>{e.commitRef}</span>
          ) : null}

          {/* Timestamp */}
          <span className="activity-timestamp" style={{
            flexShrink: 0, minWidth: '36px', textAlign: 'right',
          }}>{e.date}</span>

          {/* Remove */}
          <button
            onClick={(ev) => { ev.stopPropagation(); onRemove(e.key); }}
            aria-label="Remove activity"
            className="activity-remove activity-remove-btn"
            style={{
              fontSize: '11px', padding: '0 2px',
              lineHeight: 1, opacity: 0,
            }}
            title="Remove"
          >×</button>
        </div>
      ))}
    </div>
  );
}
