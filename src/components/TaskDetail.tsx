import React, { useState } from 'react';
import { STATUS } from '../constants/statuses.ts';
import { Timeline } from './detail/Timeline.tsx';
import { useAttachments } from '../hooks/useAttachments.ts';
import { AttachmentsList } from './detail/Attachments.tsx';
import { Dependencies } from './detail/Dependencies.tsx';
import { EpicField } from './detail/EpicField.tsx';
import { ActionButtons } from './detail/ActionButtons.tsx';
import { TaskFlags } from './detail/TaskFlags.tsx';
import {
  DETAIL_EMPTY, DETAIL_STATUS_ARIA, DETAIL_PASTED, DETAIL_BLOCKED_PLACEHOLDER,
  DETAIL_EDIT_TITLE, DETAIL_NOTES_MANUAL, DETAIL_NOTES_CLAUDE,
  DETAIL_NOTES_MANUAL_PLACEHOLDER, DETAIL_NOTES_CLAUDE_PLACEHOLDER,
  DETAIL_ENGINE_LABEL, DETAIL_ENGINE_DEFAULT,
} from '../constants/strings.ts';
import { ENGINES, getEngine } from '../constants/engines.ts';
import { useActions } from '../contexts/ActionContext.tsx';
import type { Task, TaskStatus, Epic } from '../types';

const handleKeyActivate = (handler: (e: React.KeyboardEvent<HTMLElement>) => void) => (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); }
};

interface TaskDetailProps {
  task: Task | null;
  tasks: Task[];
  epics: Epic[];
  notes: string;
}

export function TaskDetail({ task, tasks, epics, notes }: TaskDetailProps) {
  const { handleQueue: onQueue, handleUpdateTask: onUpdateTask, handleDeleteTask: onDeleteTask, handleUpdateNotes: onUpdateNotes, handleAddAttachment: onAddAttachment, handleDeleteAttachment: onDeleteAttachment, defaultEngine } = useActions();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [localDesc, setLocalDesc] = useState('');
  const [localNote, setLocalNote] = useState('');
  const [localBlockedReason, setLocalBlockedReason] = useState('');

  const { thumbUrls, pastedFeedback, dragging, handlers } = useAttachments(task, onAddAttachment);

  const [prevResetKey, setPrevResetKey] = useState('');
  const resetKey = `${task?.id}|${notes}|${task?.blockedReason || ''}|${task?.description || ''}`;
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setLocalNote(notes || '');
    setLocalBlockedReason(task?.blockedReason || '');
    setLocalDesc(task?.description || '');
    setEditing(false);
    setEditingDesc(false);
  }

  if (!task) return (
    <div className="flex-col items-center justify-center h-full gap-8" style={{ padding: '40px 20px' }}>
      <div className="empty-state">
        <div className="text-24 mb-8" style={{ opacity: 0.4 }}>&#9678;</div>
        {DETAIL_EMPTY}
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
      className="p-20 overflow-auto h-full"
      style={{
        border: dragging ? '2px dashed var(--dm-accent)' : '2px solid transparent',
        borderRadius: 'var(--dm-radius)',
        transition: 'border-color 0.2s',
        background: dragging ? 'var(--dm-accent-light)' : undefined,
      }}
      {...handlers}
    >
      <div className="flex-center gap-8 mb-12">
        <select
          aria-label={DETAIL_STATUS_ARIA}
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
          <span className="text-accent text-11 font-600" style={{ animation: 'fadeIn 0.2s' }}>
            {DETAIL_PASTED}
          </span>
        )}
      </div>

      {task.status === STATUS.IN_PROGRESS && task.progress ? (
        <div className="progress-text-shimmer progress-banner text-12 mb-12" style={{
          padding: '8px 12px', lineHeight: 1.4,
        }}>
          {task.progress}
        </div>
      ) : null}

      {task.status === STATUS.BLOCKED ? (
        <div className="mb-12">
          <input
            value={localBlockedReason}
            onInput={(e: React.FormEvent<HTMLInputElement>) => setLocalBlockedReason((e.target as HTMLInputElement).value)}
            onBlur={() => onUpdateTask(task.id, { blockedReason: localBlockedReason })}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder={DETAIL_BLOCKED_PLACEHOLDER}
            className="input-blocked w-full text-12"
            style={{ padding: '6px 8px' }}
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
          className="input-detail-title w-full text-14 mb-8"
          style={{ lineHeight: 1.4, padding: '4px 8px' }}
        />
      ) : (
        <h3
          role="button"
          tabIndex={0}
          onClick={() => { setEditName(task.fullName || task.name); setEditing(true); }}
          onKeyDown={handleKeyActivate(() => { setEditName(task.fullName || task.name); setEditing(true); })}
          className="detail-title text-14 font-600 mb-8"
          style={{ lineHeight: 1.4, padding: '4px 8px' }}
          title={DETAIL_EDIT_TITLE}
        >
          {task.fullName || task.name}
        </h3>
      )}

      {editingDesc ? (
        <textarea
          value={localDesc}
          onInput={(e: React.FormEvent<HTMLTextAreaElement>) => setLocalDesc((e.target as HTMLTextAreaElement).value)}
          onBlur={() => { onUpdateTask(task.id, { description: localDesc }); setEditingDesc(false); }}
          onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Escape') setEditingDesc(false); }}
          autoFocus
          rows={3}
          className="textarea-field w-full text-12 mb-16"
          style={{ padding: '6px 8px' }}
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setLocalDesc(task.description || ''); setEditingDesc(true); }}
          onKeyDown={handleKeyActivate(() => { setLocalDesc(task.description || ''); setEditingDesc(true); })}
          title="Click to edit description"
          className="text-12 leading-normal mb-16"
          style={{
            padding: '4px 8px',
            color: task.description ? 'var(--dm-text)' : 'var(--dm-text-light)',
            opacity: task.description ? 0.8 : 0.5,
            cursor: 'text',
          }}
        >
          {task.description || 'Add a description...'}
        </div>
      )}

      {task.skills && task.skills.length > 0 ? (
        <div className="flex-wrap gap-4 mb-12">
          {task.skills.map(s => (
            <span key={s} className="badge badge-accent text-10">{s}</span>
          ))}
        </div>
      ) : null}


      <Timeline task={task} />

      {task.summary && (
        <div className="mb-12" style={{
          padding: '10px 12px',
          background: 'var(--dm-bg)', borderRadius: 'var(--dm-radius-sm)',
          borderLeft: '3px solid var(--dm-success)',
        }}>
          <div className="label text-10" style={{ margin: '0 0 4px', color: 'var(--dm-success)' }}>What shipped</div>
          <div className="text-12 leading-normal" style={{ color: 'var(--dm-text)' }}>{task.summary}</div>
        </div>
      )}

      <EpicField task={task} epics={epics} />

      <TaskFlags task={task} />

      {!task.manual ? (
        <div className="mb-12 flex-center gap-8">
          <span className="label text-11" style={{ margin: 0 }}>{DETAIL_ENGINE_LABEL}</span>
          <div className="flex gap-4">
            {[{ id: '', label: DETAIL_ENGINE_DEFAULT + ' (' + getEngine(defaultEngine).label + ')', icon: getEngine(defaultEngine).icon, color: 'var(--dm-text-light)' }, ...ENGINES].map(eng => {
              const isSelected = eng.id === '' ? !task.engine : task.engine === eng.id;
              const displayColor = eng.id === '' ? (isSelected ? getEngine(defaultEngine).color : 'var(--dm-text-light)') : eng.color;
              return (
                <button
                  key={eng.id}
                  onClick={() => onUpdateTask(task.id, { engine: eng.id || undefined })}
                  title={eng.label}
                  className="btn"
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '12px',
                    border: isSelected ? `1.5px solid ${displayColor}` : '1px solid var(--dm-border)',
                    background: isSelected ? undefined : 'transparent',
                    color: isSelected ? displayColor : 'var(--dm-text-light)',
                    opacity: isSelected ? 1 : 0.7,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                  }}
                >
                  <span className="text-11">{eng.icon}</span>
                  {eng.id !== '' ? eng.label : DETAIL_ENGINE_DEFAULT}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mb-16">
        <div className="label mb-6">
          {task.manual ? DETAIL_NOTES_MANUAL : DETAIL_NOTES_CLAUDE}
        </div>
        <textarea
          value={localNote}
          onInput={(e: React.FormEvent<HTMLTextAreaElement>) => setLocalNote((e.target as HTMLTextAreaElement).value)}
          onBlur={() => onUpdateNotes(task.id, localNote)}
          placeholder={task.manual ? DETAIL_NOTES_MANUAL_PLACEHOLDER : DETAIL_NOTES_CLAUDE_PLACEHOLDER}
          rows={4}
          className="textarea-field w-full text-12 p-8"
        />
      </div>

      <AttachmentsList task={task} thumbUrls={thumbUrls} onDeleteAttachment={onDeleteAttachment} />

      <Dependencies task={task} tasks={tasks} />

      <ActionButtons task={task} />
    </div>
  );
}
