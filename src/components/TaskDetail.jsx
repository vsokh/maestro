import React, { useState, useEffect } from 'react';
import { PAUSED_COLOR } from '../constants/colors.js';
import { STATUS } from '../constants/statuses.js';
import { Timeline } from './detail/Timeline.jsx';
import { useAttachments, AttachmentsList } from './detail/Attachments.jsx';
import { Dependencies } from './detail/Dependencies.jsx';
import { EpicField } from './detail/EpicField.jsx';

const handleKeyActivate = (handler) => (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); }
};

export function TaskDetail({ task, tasks, epics, onQueue, onUpdateTask, onDeleteTask, notes, onUpdateNotes, dirHandle, onAddAttachment, onDeleteAttachment }) {
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
      height: '100%', color: 'var(--dm-text-light)', fontSize: '13px',
      padding: '40px 20px', textAlign: 'center', gap: '8px',
    }}>
      <div style={{ fontSize: '24px', opacity: 0.4 }}>&#9678;</div>
      Click a task to see details
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
          value={task.status}
          onChange={e => {
            const next = e.target.value;
            const updates = { status: next };
            if (task.status === STATUS.BLOCKED && next !== STATUS.BLOCKED) {
              updates.blockedReason = '';
              setLocalBlockedReason('');
            }
            onUpdateTask(task.id, updates);
          }}
          className={`badge ${badgeClass}`}
          style={{
            cursor: 'pointer', border: 'none', fontFamily: 'var(--dm-font)',
            transition: 'all 0.15s', appearance: 'none', padding: '4px 20px 4px 10px',
            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'8\' height=\'5\'%3E%3Cpath d=\'M0 0l4 5 4-5z\' fill=\'currentColor\'/%3E%3C/svg%3E")',
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center',
            outline: 'none',
          }}
        >
          {statusOptions.map(s => {
            const colors = {
              [STATUS.PENDING]: 'var(--dm-text-light)',
              [STATUS.IN_PROGRESS]: 'var(--dm-accent)',
              [STATUS.PAUSED]: PAUSED_COLOR,
              [STATUS.DONE]: 'var(--dm-success)',
              [STATUS.BLOCKED]: 'var(--dm-danger)',
              [STATUS.BACKLOG]: 'var(--dm-text-light)',
            };
            return <option key={s} value={s} style={{ background: 'var(--dm-surface)', color: colors[s] || 'var(--dm-text)' }}>{s}</option>;
          })}
        </select>
        {pastedFeedback && (
          <span style={{ fontSize: '11px', color: 'var(--dm-accent)', fontWeight: 600, animation: 'fadeIn 0.2s' }}>
            Pasted!
          </span>
        )}
      </div>

      {task.status === STATUS.IN_PROGRESS && task.progress ? (
        <div className="progress-text-shimmer" style={{
          fontSize: '12px', color: 'var(--dm-accent)', marginBottom: '12px',
          padding: '8px 12px', background: 'var(--dm-accent-light)', borderRadius: 'var(--dm-radius-sm)',
          fontWeight: 500, lineHeight: 1.4,
        }}>
          {task.progress}
        </div>
      ) : null}

      {task.status === STATUS.BLOCKED ? (
        <div style={{ marginBottom: '12px' }}>
          <input
            value={localBlockedReason}
            onInput={e => setLocalBlockedReason(e.target.value)}
            onBlur={() => onUpdateTask(task.id, { blockedReason: localBlockedReason })}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
            placeholder="Why is this blocked?"
            style={{
              width: '100%', fontSize: '12px', fontFamily: 'var(--dm-font)',
              padding: '6px 8px', border: '1px solid var(--dm-border)', borderRadius: '6px',
              background: 'var(--dm-bg)', outline: 'none',
              transition: 'border-color 0.15s', lineHeight: 1.5,
            }}
            onFocus={e => e.target.style.borderColor = 'var(--dm-accent)'}
          />
        </div>
      ) : null}

      {editing ? (
        <input
          value={editName}
          onInput={e => setEditName(e.target.value)}
          onBlur={() => { onUpdateTask(task.id, { fullName: editName, name: editName.length > 20 ? editName.slice(0,20) : editName }); setEditing(false); }}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
          style={{
            width: '100%', fontSize: '14px', fontWeight: 600, lineHeight: 1.4,
            padding: '4px 8px', border: '1px solid var(--dm-accent)', borderRadius: '4px',
            fontFamily: 'var(--dm-font)', background: 'var(--dm-surface)', marginBottom: '16px',
            outline: 'none',
          }}
        />
      ) : (
        <h3
          role="button"
          tabIndex={0}
          onClick={() => { setEditName(task.fullName || task.name); setEditing(true); }}
          onKeyDown={handleKeyActivate(() => { setEditName(task.fullName || task.name); setEditing(true); })}
          style={{
            fontSize: '14px', fontWeight: 600, marginBottom: '16px', lineHeight: 1.4,
            cursor: 'pointer', padding: '4px 8px', borderRadius: '4px',
            transition: 'background 0.15s',
          }}
          onMouseOver={e => e.target.style.background = 'var(--dm-bg)'}
          onMouseOut={e => e.target.style.background = 'transparent'}
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

      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--dm-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {task.manual ? 'Steps / Notes' : 'Notes for Claude'}
        </div>
        <textarea
          value={localNote}
          onInput={e => setLocalNote(e.target.value)}
          onBlur={() => onUpdateNotes(task.id, localNote)}
          placeholder={task.manual ? 'What you need to do...' : 'Instructions for Claude...'}
          rows="4"
          style={{
            width: '100%', fontSize: '12px', fontFamily: 'var(--dm-font)',
            padding: '8px', border: '1px solid var(--dm-border)', borderRadius: '6px',
            background: 'var(--dm-bg)', resize: 'vertical', outline: 'none',
            transition: 'border-color 0.15s', lineHeight: 1.5,
          }}
          onFocus={e => e.target.style.borderColor = 'var(--dm-accent)'}
        />
      </div>

      <AttachmentsList task={task} thumbUrls={thumbUrls} onDeleteAttachment={onDeleteAttachment} />

      <Dependencies task={task} tasks={tasks} onUpdateTask={onUpdateTask} />

      {task.status === STATUS.BACKLOG ? (
        <button
          onClick={() => onUpdateTask(task.id, { status: STATUS.PENDING })}
          title="Move from backlog to active tasks — it will appear in Up Next and can be queued"
          style={{
            width: '100%', padding: '8px 16px',
            background: 'var(--dm-accent)', color: 'white',
            border: 'none', borderRadius: 'var(--dm-radius-sm)',
            fontSize: '13px', fontWeight: 600, fontFamily: 'var(--dm-font)',
            cursor: 'pointer', transition: 'opacity 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
          onMouseOver={e => e.target.style.opacity = '0.85'}
          onMouseOut={e => e.target.style.opacity = '1'}
        >
          Activate &#8594;
        </button>
      ) : (task.status === STATUS.PENDING || task.status === STATUS.PAUSED) && task.manual ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onUpdateTask(task.id, { status: STATUS.DONE })}
            style={{
              flex: 1, padding: '8px 16px',
              background: 'var(--dm-success)', color: 'white',
              border: 'none', borderRadius: 'var(--dm-radius-sm)',
              fontSize: '13px', fontWeight: 600, fontFamily: 'var(--dm-font)',
              cursor: 'pointer', transition: 'opacity 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
            onMouseOver={e => e.target.style.opacity = '0.85'}
            onMouseOut={e => e.target.style.opacity = '1'}
          >
            Mark done &#10003;
          </button>
          <button
            onClick={() => onUpdateTask(task.id, { status: STATUS.BACKLOG })}
            title="Move to backlog"
            style={{
              padding: '8px 12px',
              background: 'none', color: 'var(--dm-text-light)',
              border: '1px solid var(--dm-border)', borderRadius: 'var(--dm-radius-sm)',
              fontSize: '12px', fontFamily: 'var(--dm-font)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseOver={e => { e.target.style.borderColor = 'var(--dm-text-light)'; }}
            onMouseOut={e => { e.target.style.borderColor = 'var(--dm-border)'; }}
          >Backlog</button>
        </div>
      ) : (task.status === STATUS.PENDING || task.status === STATUS.PAUSED) && !task.manual ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onQueue(task)}
            style={{
              flex: 1, padding: '8px 16px',
              background: 'var(--dm-accent)', color: 'white',
              border: 'none', borderRadius: 'var(--dm-radius-sm)',
              fontSize: '13px', fontWeight: 600, fontFamily: 'var(--dm-font)',
              cursor: 'pointer', transition: 'opacity 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
            onMouseOver={e => e.target.style.opacity = '0.85'}
            onMouseOut={e => e.target.style.opacity = '1'}
          >
            Queue &#9654;
          </button>
          <button
            onClick={() => onUpdateTask(task.id, { status: STATUS.BACKLOG })}
            title="Move to backlog"
            style={{
              padding: '8px 12px',
              background: 'none', color: 'var(--dm-text-light)',
              border: '1px solid var(--dm-border)', borderRadius: 'var(--dm-radius-sm)',
              fontSize: '12px', fontFamily: 'var(--dm-font)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseOver={e => { e.target.style.borderColor = 'var(--dm-text-light)'; }}
            onMouseOut={e => { e.target.style.borderColor = 'var(--dm-border)'; }}
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
        style={{
          width: '100%', padding: '6px 16px', marginTop: '8px',
          background: confirmDelete ? 'var(--dm-danger)' : 'none',
          color: confirmDelete ? 'white' : 'var(--dm-text-light)',
          border: confirmDelete ? '1px solid var(--dm-danger)' : '1px solid var(--dm-border)',
          borderRadius: 'var(--dm-radius-sm)',
          fontSize: '12px', fontFamily: 'var(--dm-font)',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseOver={e => { if (!confirmDelete) { e.target.style.color = 'var(--dm-danger)'; e.target.style.borderColor = 'var(--dm-danger)'; } }}
        onMouseOut={e => { if (!confirmDelete) { e.target.style.color = 'var(--dm-text-light)'; e.target.style.borderColor = 'var(--dm-border)'; } }}
      >{confirmDelete ? 'Confirm delete?' : 'Delete task'}</button>
    </div>
  );
}
