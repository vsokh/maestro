import React from 'react';
import { PAUSED_COLOR } from '../../constants/colors.ts';
import { STATUS } from '../../constants/statuses.ts';
import {
  TIMELINE_TITLE, TIMELINE_CREATED, TIMELINE_PENDING, TIMELINE_STARTED,
  TIMELINE_PAUSED, TIMELINE_BLOCKED, TIMELINE_COMPLETED, TIMELINE_BACKLOG,
} from '../../constants/strings.ts';
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
  [STATUS.CREATED]: TIMELINE_CREATED,
  [STATUS.PENDING]: TIMELINE_PENDING,
  [STATUS.IN_PROGRESS]: TIMELINE_STARTED,
  [STATUS.PAUSED]: TIMELINE_PAUSED,
  [STATUS.BLOCKED]: TIMELINE_BLOCKED,
  [STATUS.DONE]: TIMELINE_COMPLETED,
  [STATUS.BACKLOG]: TIMELINE_BACKLOG,
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
    <div className="mb-12" style={{ paddingLeft: '4px' }}>
      <div className="label mb-8">
        {TIMELINE_TITLE}
      </div>
      {history.map((entry, i) => {
        const next = history[i + 1];
        const duration = next ? formatDuration(entry.at, next.at) : null;
        const isLast = i === history.length - 1;
        return (
          <div key={i}>
            <div className="flex items-start gap-10">
              <div className="flex-col items-center shrink-0" style={{ width: '12px' }}>
                <div className="timeline-dot shrink-0" style={{ background: dotColor[entry.status] || 'var(--dm-text-light)' }} />
                {!isLast && <div className="timeline-connector flex-1" style={{ minHeight: '12px' }} />}
              </div>
              <div className="pb-4">
                <div className="text-11 font-600" style={{ color: 'var(--dm-text-muted)' }}>{label[entry.status] || entry.status}</div>
                <div className="text-12" style={{ color: 'var(--dm-text)' }}>{formatDate(entry.at)}</div>
              </div>
            </div>
            {duration && (
              <div className="flex-center gap-10">
                <div className="flex justify-center shrink-0" style={{ width: '12px' }}>
                  <div className="timeline-connector-v" style={{ width: '1px', height: '16px' }} />
                </div>
                <div className="text-10" style={{ color: 'var(--dm-text-light)', fontStyle: 'italic' }}>{duration}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
