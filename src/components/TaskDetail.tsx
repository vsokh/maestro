import React, { useState, useEffect } from 'react';
import { STATUS } from '../constants/statuses.ts';
import { Timeline } from './detail/Timeline.tsx';
import { useAttachments, AttachmentsList } from './detail/Attachments.tsx';
import { Dependencies } from './detail/Dependencies.tsx';
import { EpicField } from './detail/EpicField.tsx';
import type { Task, TaskStatus, Epic } from '../types';

const handleKeyActivate = (handler: (e: React.KeyboardEvent<HTMLElement>) => void) => (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); }
};

interface TaskDetailProps {
  task: Task | null;
  tasks: Task[];
  epics: Epic[];
  onQueue: (task: Task) => void;
  onUpdateTask: (id: number, updates: Partial<Task>) => void;
  onDeleteTask: (id: number) => void;
  notes: string;
  onUpdateNotes: (id: number, note: string) => void;
  dirHandle: FileSystemDirectoryHandle | null;
  onAddAttachment: (taskId: number, file: File) => void;
  onDeleteAttachment: (taskId: number, attachmentId: string) => void;
}

export function TaskDetail({ task, tasks, epics, onQueue, onUpdateTask, onDeleteTask, notes, onUpdateNotes, dirHandle, onAddAttachment, onDeleteAttachment }: TaskDetailProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [localNote, setLocalNote] = useState('');
  const [localBlockedReason, setLocalBlockedReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { thumbUrls, pastedFeedback, dragging, handlers } = useAttachments(task, dirHandle, onAddAttachment);

  useEffect(() => {
    setLocalNote(notes || '');
    setLocalBlockedReason(task?.blockedReason || '');
    setEditing(false);
    setConfirmDelete(false);
  }, [task?.id, notes]);

  if (!task) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: '40px 20px', gap: '8px',
    }}>
      <div className="empty-state">
        <div style={{ fontSize: '24px', opacity: 0.4, marginBottom: '8px' }}>&#9678;</div>
        Click a task to see details
      </div>
    </div>
  );

  const statusOptions = [STATUS.PENDING, STATUS.IN_PROGRESS, STATUS.PAUSED, STATUS.DONE, STATUS.BLOCKED, STATUS.BACKLOG];

  const badgeClass = task.status === STATUS.DONE ? 'badge-done'
    : task.status === STATUS.BLOCKED ? 'badge-blocked'
    : task.status === STATUS.IN_PROGRESS ? 'badge-in-progress'
    : task.status === STATUS.PAUSED ? 'badge-paused'
    : task.status === STATUS.BACKLOG ? 'badge-backlog'
    : 'badge-pending';

  return (
    <div
      style={{
        padding: '20px', overflow: 'auto', height: '100%',
        border: dragging ? '2px dashed var(--dm-accent)' : '2px solid transparent',
        borderRadius: 'var(--dm-radius)',
        transition: 'border-color 0.2s',
        background: dragging ? 'var(--dm-accent-light)' : undefined,
      }}
      {...handlers}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <select
          aria-label="Task status"
          value={task.status}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            const next = e.target.value as TaskStatus;
            const updates: Partial<Task> = { status: next };
            if (task.status === STATUS.BLOCKED && next !== STATUS.BLOCKED) {
              updates.blockedReason = '';
              setLocalBlockedReason('');
            }
            onUpdateTask(task.id, updates);
          }}
          className={`badge ${badgeClass} select-field`}
          style={{ padding: '4px 20px 4px 10px' }}
        >
          {statusOptions.map(s => {
            return <option key={s} value={s} style={{ background: 'var(--dm-surface)' }}>{s}</option>;
          })}
        </select>
        {pastedFeedback && (
          <span className="text-accent" style={{ fontSize: '11px', fontWeight: 600, animation: 'fadeIn 0.2s' }}>
            Pasted!
          </span>
        )}
      </div>

      {task.status === STATUS.IN_PROGRESS && task.progress ? (
        <div className="progress-text-shimmer progress-banner" style={{
          fontSize: '12px', marginBottom: '12px',
          padding: '8px 12px', lineHeight: 1.4,
        }}>
          {task.progress}
        </div>
      ) : null}

      {task.status === STATUS.BLOCKED ? (
        <div style={{ marginBottom: '12px' }}>
          <input
            value={localBlockedReason}
            onInput={(e: React.FormEvent<HTMLInputElement>) => setLocalBlockedReason((e.target as HTMLInputElement).value)}
            onBlur={() => onUpdateTask(task.id, { blockedReason: localBlockedReason })}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder="Why is this blocked?"
            className="input-blocked"
            style={{ width: '100%', fontSize: '12px', padding: '6px 8px' }}
          />
        </div>
      ) : null}

      {editing ? (
        <input
          value={editName}
          onInput={(e: React.FormEvent<HTMLInputElement>) => setEditName((e.target as HTMLInputElement).value)}
          onBlur={() => { onUpdateTask(task.id, { fullName: editName, name: editName.length > 20 ? editName.slice(0,20) : editName }); setEditing(false); }}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
          className="input-detail-title"
          style={{
            width: '100%', fontSize: '14px', lineHeight: 1.4,
            padding: '4px 8px', marginBottom: '16px',
          }}
        />
      ) : (
        <h3
          role="button"
          tabIndex={0}
          onClick={() => { setEditName(task.fullName || task.name); setEditing(true); }}
          onKeyDown={handleKeyActivate(() => { setEditName(task.fullName || task.name); setEditing(true); })}
          className="detail-title"
          style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', lineHeight: 1.4, padding: '4px 8px' }}
          title="Click to edit"
        >
          {task.fullName || task.name}
        </h3>
      )}


      {task.skills && task.skills.length > 0 ? (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {task.skills.map(s => (
            <span key={s} className="badge badge-accent" style={{ fontSize: '10px' }}>{s}</span>
          ))}
        </div>
      ) : null}


      <Timeline task={task} />

      <EpicField task={task} epics={epics} onUpdateTask={onUpdateTask} />

      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: task.supervision ? 'var(--dm-amber)' : 'var(--dm-text-light)' }}>
          <input
            type="checkbox"
            checked={!!task.supervision}
            onChange={e => onUpdateTask(task.id, { supervision: e.target.checked || undefined })}
            style={{ accentColor: 'var(--dm-amber)', cursor: 'pointer' }}
          />
          <span style={{ fontWeight: 600 }}>Needs review</span>
        </label>
        {task.supervision ? (
          <span style={{ fontSize: '10px', color: 'var(--dm-text-light)', fontStyle: 'italic' }}>Complex or risky — review plan carefully</span>
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
          <span style={{ fontWeight: 600 }}>Auto-approve</span>
        </label>
        {task.autoApprove ? (
          <span style={{ fontSize: '10px', color: 'var(--dm-text-light)', fontStyle: 'italic' }}>Skip plan — go straight to implementation</span>
        ) : null}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div className="label" style={{ marginBottom: '6px' }}>
          {task.manual ? 'Steps / Notes' : 'Notes for Claude'}
        </div>
        <textarea
          value={localNote}
          onInput={(e: React.FormEvent<HTMLTextAreaElement>) => setLocalNote((e.target as HTMLTextAreaElement).value)}
          onBlur={() => onUpdateNotes(task.id, localNote)}
          placeholder={task.manual ? 'What you need to do...' : 'Instructions for Claude...'}
          rows={4}
          className="textarea-field"
          style={{ width: '100%', fontSize: '12px', padding: '8px' }}
        />
      </div>

      <AttachmentsList task={task} thumbUrls={thumbUrls} onDeleteAttachment={onDeleteAttachment} />

      <Dependencies task={task} tasks={tasks} onUpdateTask={onUpdateTask} />

      {task.status === STATUS.BACKLOG ? (
        <button
          onClick={() => onUpdateTask(task.id, { status: STATUS.PENDING })}
          title="Move from backlog to active tasks — it will appear in Up Next and can be queued"
          className="btn btn-primary"
          style={{
            width: '100%', padding: '8px 16px', fontSize: '13px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          Activate &#8594;
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
            Mark done &#10003;
          </button>
          <button
            onClick={() => onUpdateTask(task.id, { status: STATUS.BACKLOG })}
            title="Move to backlog"
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '12px' }}
          >Backlog</button>
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
            Queue &#9654;
          </button>
          <button
            onClick={() => onUpdateTask(task.id, { status: STATUS.BACKLOG })}
            title="Move to backlog"
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '12px' }}
          >Backlog</button>
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
      >{confirmDelete ? 'Confirm delete?' : 'Delete task'}</button>
    </div>
  );
}
