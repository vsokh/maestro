import React, { useState } from 'react';
import { STATUS } from '../../constants/statuses.ts';
import {
  DETAIL_ACTIVATE_TOOLTIP, DETAIL_ACTIVATE, DETAIL_MARK_DONE, DETAIL_MOVE_BACKLOG,
  DETAIL_BACKLOG, DETAIL_QUEUE, DETAIL_CONFIRM_DELETE, DETAIL_DELETE,
} from '../../constants/strings.ts';
import type { Task } from '../../types';

interface ActionButtonsProps {
  task: Task;
  onQueue: (task: Task) => void;
  onUpdateTask: (id: number, updates: Partial<Task>) => void;
  onDeleteTask: (id: number) => void;
}

export function ActionButtons({ task, onQueue, onUpdateTask, onDeleteTask }: ActionButtonsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset confirm state when task changes
  const [prevTaskId, setPrevTaskId] = useState(task.id);
  if (task.id !== prevTaskId) {
    setPrevTaskId(task.id);
    setConfirmDelete(false);
  }

  return (
    <>
      {task.status === STATUS.BACKLOG ? (
        <button
          onClick={() => onUpdateTask(task.id, { status: STATUS.PENDING })}
          title={DETAIL_ACTIVATE_TOOLTIP}
          className="btn btn-primary"
          style={{
            width: '100%', padding: '8px 16px', fontSize: '13px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          {DETAIL_ACTIVATE}
        </button>
      ) : (task.status === STATUS.PENDING || task.status === STATUS.PAUSED) && task.manual ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onUpdateTask(task.id, { status: STATUS.DONE })}
            className="btn btn-success"
            style={{
              flex: 1, padding: '8px 16px', fontSize: '13px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            {DETAIL_MARK_DONE}
          </button>
          <button
            onClick={() => onUpdateTask(task.id, { status: STATUS.BACKLOG })}
            title={DETAIL_MOVE_BACKLOG}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '12px' }}
          >{DETAIL_BACKLOG}</button>
        </div>
      ) : (task.status === STATUS.PENDING || task.status === STATUS.PAUSED) && !task.manual ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onQueue(task)}
            className="btn btn-primary"
            style={{
              flex: 1, padding: '8px 16px', fontSize: '13px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            {DETAIL_QUEUE}
          </button>
          <button
            onClick={() => onUpdateTask(task.id, { status: STATUS.BACKLOG })}
            title={DETAIL_MOVE_BACKLOG}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '12px' }}
          >{DETAIL_BACKLOG}</button>
        </div>
      ) : null}

      <button
        onClick={() => {
          if (confirmDelete) { onDeleteTask(task.id); setConfirmDelete(false); }
          else { setConfirmDelete(true); }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setConfirmDelete(false);
        }}
        onBlur={() => setConfirmDelete(false)}
        className={`btn ${confirmDelete ? 'btn-primary' : 'btn-danger-outline'}`}
        style={{
          width: '100%', padding: '6px 16px', marginTop: '8px', fontSize: '12px',
          background: confirmDelete ? 'var(--dm-danger)' : undefined,
          border: confirmDelete ? '1px solid var(--dm-danger)' : undefined,
          color: confirmDelete ? 'white' : undefined,
        }}
      >{confirmDelete ? DETAIL_CONFIRM_DELETE : DETAIL_DELETE}</button>
    </>
  );
}
