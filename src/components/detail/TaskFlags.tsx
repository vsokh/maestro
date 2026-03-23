import React from 'react';
import {
  DETAIL_NEEDS_REVIEW, DETAIL_REVIEW_HELP, DETAIL_AUTO_APPROVE, DETAIL_AUTO_APPROVE_HELP,
} from '../../constants/strings.ts';
import type { Task } from '../../types';

interface TaskFlagsProps {
  task: Task;
  onUpdateTask: (id: number, updates: Partial<Task>) => void;
}

export function TaskFlags({ task, onUpdateTask }: TaskFlagsProps) {
  return (
    <>
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: task.supervision ? 'var(--dm-amber)' : 'var(--dm-text-light)' }}>
          <input
            type="checkbox"
            checked={!!task.supervision}
            onChange={e => onUpdateTask(task.id, { supervision: e.target.checked || undefined })}
            style={{ accentColor: 'var(--dm-amber)', cursor: 'pointer' }}
          />
          <span style={{ fontWeight: 600 }}>{DETAIL_NEEDS_REVIEW}</span>
        </label>
        {task.supervision ? (
          <span style={{ fontSize: '10px', color: 'var(--dm-text-light)', fontStyle: 'italic' }}>{DETAIL_REVIEW_HELP}</span>
        ) : null}
      </div>

      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: task.autoApprove ? 'var(--dm-success)' : 'var(--dm-text-light)' }}>
          <input
            type="checkbox"
            checked={!!task.autoApprove}
            onChange={e => onUpdateTask(task.id, { autoApprove: e.target.checked || undefined })}
            style={{ accentColor: 'var(--dm-success)', cursor: 'pointer' }}
          />
          <span style={{ fontWeight: 600 }}>{DETAIL_AUTO_APPROVE}</span>
        </label>
        {task.autoApprove ? (
          <span style={{ fontSize: '10px', color: 'var(--dm-text-light)', fontStyle: 'italic' }}>{DETAIL_AUTO_APPROVE_HELP}</span>
        ) : null}
      </div>
    </>
  );
}
