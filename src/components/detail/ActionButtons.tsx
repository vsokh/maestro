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
          className="btn btn-primary w-full flex-center justify-center gap-6 text-13"
          style={{ padding: '8px 16px' }}
        >
          {DETAIL_ACTIVATE}
        </button>
      ) : (task.status === STATUS.PENDING || task.status === STATUS.PAUSED) && task.manual ? (
        <div className="flex gap-8">
          <button
            onClick={() => onUpdateTask(task.id, { status: STATUS.DONE })}
            className="btn btn-success flex-1 flex-center justify-center gap-6 text-13"
            style={{ padding: '8px 16px' }}
          >
            {DETAIL_MARK_DONE}
          </button>
          <button
            onClick={() => onUpdateTask(task.id, { status: STATUS.BACKLOG })}
            title={DETAIL_MOVE_BACKLOG}
            className="btn btn-secondary text-12"
            style={{ padding: '8px 12px' }}
          >{DETAIL_BACKLOG}</button>
        </div>
      ) : (task.status === STATUS.PENDING || task.status === STATUS.PAUSED) && !task.manual ? (
        <div className="flex gap-8">
          <button
            onClick={() => onQueue(task)}
            className="btn btn-primary flex-1 flex-center justify-center gap-6 text-13"
            style={{ padding: '8px 16px' }}
          >
            {DETAIL_QUEUE}
          </button>
          <button
            onClick={() => onUpdateTask(task.id, { status: STATUS.BACKLOG })}
            title={DETAIL_MOVE_BACKLOG}
            className="btn btn-secondary text-12"
            style={{ padding: '8px 12px' }}
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
        className={`btn w-full mt-8 text-12 ${confirmDelete ? 'btn-primary' : 'btn-danger-outline'}`}
        style={{
          padding: '6px 16px',
          background: confirmDelete ? 'var(--dm-danger)' : undefined,
          border: confirmDelete ? '1px solid var(--dm-danger)' : undefined,
          color: confirmDelete ? 'white' : undefined,
        }}
      >{confirmDelete ? DETAIL_CONFIRM_DELETE : DETAIL_DELETE}</button>
    </>
  );
}
