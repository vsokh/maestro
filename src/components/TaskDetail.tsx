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
  onAddAttachment: (taskId: number, file: File) => void;
  onDeleteAttachment: (taskId: number, attachmentId: string) => void;
  defaultEngine?: string;
}

export function TaskDetail({ task, tasks, epics, onQueue, onUpdateTask, onDeleteTask, notes, onUpdateNotes, onAddAttachment, onDeleteAttachment, defaultEngine }: TaskDetailProps) {
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
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: '40px 20px', gap: '8px',
    }}>
      <div className="empty-state">
        <div style={{ fontSize: '24px', opacity: 0.4, marginBottom: '8px' }}>&#9678;</div>
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
          <span className="text-accent" style={{ fontSize: '11px', fontWeight: 600, animation: 'fadeIn 0.2s' }}>
            {DETAIL_PASTED}
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
            placeholder={DETAIL_BLOCKED_PLACEHOLDER}
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
            padding: '4px 8px', marginBottom: '8px',
          }}
        />
      ) : (
        <h3
          role="button"
          tabIndex={0}
          onClick={() => { setEditName(task.fullName || task.name); setEditing(true); }}
          onKeyDown={handleKeyActivate(() => { setEditName(task.fullName || task.name); setEditing(true); })}
          className="detail-title"
          style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', lineHeight: 1.4, padding: '4px 8px' }}
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
          className="textarea-field"
          style={{ width: '100%', fontSize: '12px', padding: '6px 8px', marginBottom: '16px' }}
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setLocalDesc(task.description || ''); setEditingDesc(true); }}
          onKeyDown={handleKeyActivate(() => { setLocalDesc(task.description || ''); setEditingDesc(true); })}
          title="Click to edit description"
          style={{
            fontSize: '12px', lineHeight: 1.5, padding: '4px 8px', marginBottom: '16px',
            color: task.description ? 'var(--dm-text)' : 'var(--dm-text-light)',
            opacity: task.description ? 0.8 : 0.5,
            cursor: 'text',
          }}
        >
          {task.description || 'Add a description...'}
        </div>
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

      <TaskFlags task={task} onUpdateTask={onUpdateTask} />

      {!task.manual ? (
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="label" style={{ fontSize: '11px', margin: 0 }}>{DETAIL_ENGINE_LABEL}</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[{ id: '', label: DETAIL_ENGINE_DEFAULT + ' (' + getEngine(defaultEngine).label + ')', icon: getEngine(defaultEngine).icon, color: 'var(--dm-text-light)' }, ...ENGINES].map(eng => {
              const isSelected = eng.id === '' ? !task.engine : task.engine === eng.id;
              const displayColor = eng.id === '' ? (isSelected ? getEngine(defaultEngine).color : 'var(--dm-text-light)') : (eng as any).color;
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
                  <span style={{ fontSize: '11px' }}>{eng.icon}</span>
                  {eng.id !== '' ? eng.label : DETAIL_ENGINE_DEFAULT}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div style={{ marginBottom: '16px' }}>
        <div className="label" style={{ marginBottom: '6px' }}>
          {task.manual ? DETAIL_NOTES_MANUAL : DETAIL_NOTES_CLAUDE}
        </div>
        <textarea
          value={localNote}
          onInput={(e: React.FormEvent<HTMLTextAreaElement>) => setLocalNote((e.target as HTMLTextAreaElement).value)}
          onBlur={() => onUpdateNotes(task.id, localNote)}
          placeholder={task.manual ? DETAIL_NOTES_MANUAL_PLACEHOLDER : DETAIL_NOTES_CLAUDE_PLACEHOLDER}
          rows={4}
          className="textarea-field"
          style={{ width: '100%', fontSize: '12px', padding: '8px' }}
        />
      </div>

      <AttachmentsList task={task} thumbUrls={thumbUrls} onDeleteAttachment={onDeleteAttachment} />

      <Dependencies task={task} tasks={tasks} onUpdateTask={onUpdateTask} />

      <ActionButtons task={task} onQueue={onQueue} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} />
    </div>
  );
}
