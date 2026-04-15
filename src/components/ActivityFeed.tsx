import type { Activity, Task } from '../types';
import React, { useMemo, useState } from 'react';
import {
  ACTIVITY_EMPTY, ACTIVITY_REMOVE_ARIA, ACTIVITY_REMOVE_TITLE,
} from '../constants/strings.ts';
import { STATUS } from '../constants/statuses.ts';
import { useActions } from '../contexts/ActionContext.tsx';
import { TaskPreviewPopup } from './TaskPreviewPopup.tsx';

function isCompleted(label: string) {
  return /completed|done/i.test(label);
}

const handleKeyActivate = (handler: (e: React.KeyboardEvent<HTMLElement>) => void) => (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); }
};

interface ActivityFeedProps {
  activity: Activity[];
  tasks: Task[];
}

export function ActivityFeed({ activity, tasks }: ActivityFeedProps) {
  const { handleRemoveActivity: onRemove, handleNavigateToTask: onNavigateToTask } = useActions();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewTaskId, setPreviewTaskId] = useState<number | null>(null);
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
          changes: a.changes || null,
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
        {ACTIVITY_EMPTY}
      </div>
    );
  }

  const previewTask = previewTaskId != null ? tasks.find(t => t.id === previewTaskId) || null : null;

  return (
    <div style={{ padding: '2px 0' }}>
      {previewTask && (
        <TaskPreviewPopup task={previewTask} onClose={() => setPreviewTaskId(null)} />
      )}
      {entries.map(e => (
        <div key={e.key}>
          <div
            className={'activity-row flex-center gap-8' + (e.clickableTaskId != null ? ' activity-clickable' : '')}
            role={e.clickableTaskId != null || e.changes ? 'button' : undefined}
            tabIndex={e.clickableTaskId != null || e.changes ? 0 : undefined}
            style={{
              padding: '5px 14px',
              opacity: e.isToday ? 1 : 0.6,
              cursor: e.changes ? 'pointer' : undefined,
            }}
            onClick={e.clickableTaskId != null ? () => {
              const task = tasks.find(t => t.id === e.clickableTaskId);
              if (task && task.status === STATUS.DONE) setPreviewTaskId(e.clickableTaskId!);
              else onNavigateToTask(e.clickableTaskId!);
            } : e.changes ? () => setExpandedId(expandedId === e.key ? null : e.key) : undefined}
            onKeyDown={e.clickableTaskId != null ? handleKeyActivate(() => {
              const task = tasks.find(t => t.id === e.clickableTaskId);
              if (task && task.status === STATUS.DONE) setPreviewTaskId(e.clickableTaskId!);
              else onNavigateToTask(e.clickableTaskId!);
            }) : e.changes ? handleKeyActivate(() => setExpandedId(expandedId === e.key ? null : e.key)) : undefined}
          >
            {/* Colored dot */}
            <span className={`activity-dot shrink-0 ${e.completed ? 'activity-dot--completed' : 'activity-dot--default'}`} style={{
              width: 6, height: 6,
            }} />

            {/* Label */}
            <span className="activity-label flex-1 text-12 truncate" style={{
              color: e.clickableTaskId != null ? 'var(--dm-accent)' : 'var(--dm-text)',
              fontWeight: e.isToday ? 500 : 400,
            }}>
              {e.changes ? (expandedId === e.key ? '▾ ' : '▸ ') : ''}{e.label}
            </span>

            {/* Metadata */}
            {e.commitRef ? (
              <span className="commit-ref shrink-0 text-10" style={{
                padding: '0 5px',
              }}>{e.commitRef}</span>
            ) : null}

            {/* Timestamp */}
            <span className="activity-timestamp shrink-0 text-right" style={{
              minWidth: '36px',
            }}>{e.date}</span>

            {/* Remove */}
            <button
              onClick={(ev) => { ev.stopPropagation(); onRemove(e.key); }}
              aria-label={ACTIVITY_REMOVE_ARIA}
              className="activity-remove activity-remove-btn text-11"
              style={{
                padding: '0 2px',
                lineHeight: 1, opacity: 0,
              }}
              title={ACTIVITY_REMOVE_TITLE}
            >×</button>
          </div>
          {e.changes && expandedId === e.key && (
            <div className="text-11" style={{
              padding: '4px 14px 8px 28px',
              color: 'var(--dm-text-muted)',
              lineHeight: 1.6,
            }}>
              {e.changes.map((c, i) => (
                <div key={i} className="flex gap-6">
                  <span className="shrink-0" style={{ color: 'var(--dm-amber)' }}>-</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
