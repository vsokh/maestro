import React from 'react';
import { PAUSED_COLOR } from '../../constants/colors.ts';
import { STATUS } from '../../constants/statuses.ts';
import type { Task, HistoryEntry } from '../../types';

function formatDate(iso: string | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDuration(from: string | undefined, to: string | undefined) {
  if (!from || !to) return null;
  const ms = new Date(to!).getTime() - new Date(from!).getTime();
  if (ms < 0 || isNaN(ms)) return null;
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return days + 'd ' + (hrs % 24) + 'h';
  if (hrs > 0) return hrs + 'h ' + (mins % 60) + 'm';
  return mins + 'm';
}

const dotColor: Record<string, string> = {
  [STATUS.CREATED]: 'var(--dm-text-light)',
  [STATUS.PENDING]: 'var(--dm-text-light)',
  [STATUS.IN_PROGRESS]: 'var(--dm-accent)',
  [STATUS.PAUSED]: PAUSED_COLOR,
  [STATUS.BLOCKED]: 'var(--dm-danger)',
  [STATUS.DONE]: 'var(--dm-success)',
  [STATUS.BACKLOG]: 'var(--dm-text-light)',
};

const label: Record<string, string> = {
  [STATUS.CREATED]: 'Created',
  [STATUS.PENDING]: 'Pending',
  [STATUS.IN_PROGRESS]: 'Started',
  [STATUS.PAUSED]: 'Paused',
  [STATUS.BLOCKED]: 'Blocked',
  [STATUS.DONE]: 'Completed',
  [STATUS.BACKLOG]: 'Backlog',
};

interface TimelineProps {
  task: Task;
}

export function Timeline({ task }: TimelineProps) {
  // Build history: from task.history array, or fallback to legacy timestamp fields
  const history: HistoryEntry[] = task.history || [];
  if (history.length === 0) {
    if (task.createdAt) history.push({ status: STATUS.CREATED, at: task.createdAt });
    if (task.startedAt) history.push({ status: STATUS.IN_PROGRESS, at: task.startedAt });
    if (task.pausedAt) history.push({ status: STATUS.PAUSED, at: task.pausedAt });
    if (task.completedAt) history.push({ status: STATUS.DONE, at: task.completedAt });
  }
  if (history.length === 0) return null;

  return (
    <div style={{ marginBottom: '12px', paddingLeft: '4px' }}>
      <div className="label" style={{ marginBottom: '8px' }}>
        Timeline
      </div>
      {history.map((entry, i) => {
        const next = history[i + 1];
        const duration = next ? formatDuration(entry.at, next.at) : null;
        const isLast = i === history.length - 1;
        return (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12px', flexShrink: 0 }}>
                <div className="timeline-dot" style={{ background: dotColor[entry.status] || 'var(--dm-text-light)', flexShrink: 0 }} />
                {!isLast && <div className="timeline-connector" style={{ flex: 1, minHeight: '12px' }} />}
              </div>
              <div style={{ paddingBottom: '4px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--dm-text-muted)' }}>{label[entry.status] || entry.status}</div>
                <div style={{ fontSize: '12px', color: 'var(--dm-text)' }}>{formatDate(entry.at)}</div>
              </div>
            </div>
            {duration && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '12px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                  <div className="timeline-connector-v" style={{ width: '1px', height: '16px' }} />
                </div>
                <div style={{ fontSize: '10px', color: 'var(--dm-text-light)', fontStyle: 'italic' }}>{duration}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
