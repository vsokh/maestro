import React from 'react';
import { PIPELINE_STAGES, getItemStatus } from './queueItemUtils.ts';
import type { Task, QueueItem } from '../../types';

interface PipelineLegendProps {
  queue: QueueItem[];
  taskMap: Map<number, Task>;
}

export function PipelineLegend({ queue, taskMap }: PipelineLegendProps) {
  // Count tasks in each stage
  const counts: Record<string, number> = {};
  for (const item of queue) {
    const status = getItemStatus(item, taskMap);
    if (status !== 'queued' && status !== 'paused' && status !== 'error') {
      counts[status] = (counts[status] || 0) + 1;
    }
  }

  const hasActive = Object.keys(counts).length > 0;
  if (!hasActive) return null;

  // Find the furthest active stage index
  let furthestActive = -1;
  PIPELINE_STAGES.forEach((stage, i) => {
    if (counts[stage.id]) furthestActive = i;
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '8px 12px', marginBottom: '4px',
      fontSize: '10px',
    }}>
      {PIPELINE_STAGES.map((stage, i) => {
        const count = counts[stage.id] || 0;
        const isActive = count > 0;
        const isPast = i < furthestActive && !isActive;

        return (
          <React.Fragment key={stage.id}>
            {i > 0 && (
              <svg width="16" height="10" viewBox="0 0 16 10" style={{ flexShrink: 0, margin: '0 1px' }}>
                <path
                  d="M0 5 L12 5 M9 2 L13 5 L9 8"
                  fill="none"
                  stroke={isPast || isActive ? 'var(--dm-text-light)' : 'var(--dm-border)'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isPast || isActive ? 0.6 : 0.25}
                />
              </svg>
            )}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              padding: '2px 8px',
              borderRadius: '10px',
              background: isActive ? stage.bg : 'transparent',
              color: isActive ? '#fff' : isPast ? 'var(--dm-text-light)' : 'var(--dm-text-muted)',
              fontWeight: isActive ? 700 : 400,
              opacity: isActive ? 1 : isPast ? 0.6 : 0.35,
              transition: 'all 0.3s',
              whiteSpace: 'nowrap',
            }}>
              {stage.label}
              {count > 1 && (
                <span style={{
                  fontSize: '9px',
                  background: 'rgba(255,255,255,0.25)',
                  borderRadius: '6px',
                  padding: '0 4px',
                  fontWeight: 700,
                }}>{count}</span>
              )}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
