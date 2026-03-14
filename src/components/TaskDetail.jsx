import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { readAttachmentUrl } from '../fs.js';

const EPIC_PALETTE = [
  { bg: 'rgba(106,141,190,0.12)', text: '#6a8dbe', border: 'rgba(106,141,190,0.3)' },
  { bg: 'rgba(196,132,90,0.12)', text: '#c4845a', border: 'rgba(196,132,90,0.3)' },
  { bg: 'rgba(155,139,180,0.12)', text: '#9b8bb4', border: 'rgba(155,139,180,0.3)' },
  { bg: 'rgba(90,158,114,0.12)', text: '#5a9e72', border: 'rgba(90,158,114,0.3)' },
  { bg: 'rgba(180,120,120,0.12)', text: '#b47878', border: 'rgba(180,120,120,0.3)' },
  { bg: 'rgba(120,165,165,0.12)', text: '#78a5a5', border: 'rgba(120,165,165,0.3)' },
  { bg: 'rgba(170,150,100,0.12)', text: '#aa9664', border: 'rgba(170,150,100,0.3)' },
  { bg: 'rgba(140,130,170,0.12)', text: '#8c82aa', border: 'rgba(140,130,170,0.3)' },
];

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function TaskDetail({ task, tasks, epics, onQueue, onUpdateTask, onDeleteTask, notes, onUpdateNotes, dirHandle, onAddAttachment, onDeleteAttachment }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [localNote, setLocalNote] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [pastedFeedback, setPastedFeedback] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [thumbUrls, setThumbUrls] = useState({});
  const [localBlockedReason, setLocalBlockedReason] = useState('');
  const dragCounter = useRef(0);

  useEffect(() => {
    setLocalNote(notes || '');
    setLocalDescription(task?.description || '');
    setLocalBlockedReason(task?.blockedReason || '');
    setEditing(false);
  }, [task?.id, notes]);

  // Load thumbnail URLs when task/attachments change
  useEffect(() => {
    if (!task || !dirHandle || !task.attachments?.length) {
      setThumbUrls({});
      return;
    }

    let cancelled = false;
    const urls = {};

    (async () => {
      for (const att of task.attachments) {
        if (cancelled) break;
        const url = await readAttachmentUrl(dirHandle, task.id, att.filename);
        if (url) urls[att.id] = url;
      }
      if (!cancelled) setThumbUrls(urls);
    })();

    return () => {
      cancelled = true;
      // Revoke old URLs to prevent memory leaks
      Object.values(urls).forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    };
  }, [task?.id, task?.attachments, dirHandle]);

  // Clean up thumb URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(thumbUrls).forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    };
  }, []);

  const handleImageFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'png';
    const filename = `screenshot-${Date.now()}.${ext}`;
    const renamedFile = new File([file], filename, { type: file.type });
    onAddAttachment(task.id, renamedFile);
    setPastedFeedback(true);
    setTimeout(() => setPastedFeedback(false), 1500);
  }, [task?.id, onAddAttachment]);

  const handlePaste = useCallback((e) => {
    if (!task || !onAddAttachment) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        handleImageFile(blob);
        return;
      }
    }
  }, [task, onAddAttachment, handleImageFile]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;
    if (!task || !onAddAttachment) return;
    const files = e.dataTransfer?.files;
    if (files) {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          handleImageFile(file);
        }
      }
    }
  }, [task, onAddAttachment, handleImageFile]);

  if (!task) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', color: 'var(--text-light)', fontSize: '13px',
      padding: '40px 20px', textAlign: 'center', gap: '8px',
    }}>
      <div style={{ fontSize: '24px', opacity: 0.4 }}>&#9678;</div>
      Click a task to see details
    </div>
  );

  const statusOptions = ['pending', 'in-progress', 'paused', 'done', 'blocked'];
  const currentIdx = statusOptions.indexOf(task.status);

  const badgeClass = task.status === 'done' ? 'badge-done'
    : task.status === 'blocked' ? 'badge-blocked'
    : task.status === 'in-progress' ? 'badge-in-progress'
    : task.status === 'paused' ? 'badge-paused'
    : 'badge-pending';

  const attachments = task.attachments || [];

  return (
    <div
      style={{
        padding: '20px', overflow: 'auto', height: '100%',
        border: dragging ? '2px dashed var(--accent)' : '2px solid transparent',
        borderRadius: 'var(--radius)',
        transition: 'border-color 0.2s',
        background: dragging ? 'var(--accent-light)' : undefined,
      }}
      onPaste={handlePaste}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <button
          onClick={() => {
            const next = statusOptions[(currentIdx + 1) % statusOptions.length];
            const updates = { status: next };
            if (task.status === 'blocked' && next !== 'blocked') {
              updates.blockedReason = '';
              setLocalBlockedReason('');
            }
            onUpdateTask(task.id, updates);
          }}
          className={`badge ${badgeClass}`}
          style={{ cursor: 'pointer', border: 'none', fontFamily: 'var(--font)', transition: 'all 0.15s' }}
          title="Click to cycle status"
        >
          {task.status} &#8635;
        </button>
        {pastedFeedback && (
          <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, animation: 'fadeIn 0.2s' }}>
            Pasted!
          </span>
        )}
      </div>

      {task.status === 'in-progress' && task.progress ? (
        <div className="progress-text-shimmer" style={{
          fontSize: '12px', color: 'var(--accent)', marginBottom: '12px',
          padding: '8px 12px', background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)',
          fontWeight: 500, lineHeight: 1.4,
        }}>
          {task.progress}
        </div>
      ) : null}

      {task.status === 'blocked' ? (
        <div style={{ marginBottom: '12px' }}>
          <input
            value={localBlockedReason}
            onInput={e => setLocalBlockedReason(e.target.value)}
            onBlur={() => onUpdateTask(task.id, { blockedReason: localBlockedReason })}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
            placeholder="Why is this blocked?"
            style={{
              width: '100%', fontSize: '12px', fontFamily: 'var(--font)',
              padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px',
              background: 'var(--bg)', outline: 'none',
              transition: 'border-color 0.15s', lineHeight: 1.5,
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
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
            padding: '4px 8px', border: '1px solid var(--accent)', borderRadius: '4px',
            fontFamily: 'var(--font)', background: 'var(--surface)', marginBottom: '16px',
            outline: 'none',
          }}
        />
      ) : (
        <h3
          onClick={() => { setEditName(task.fullName || task.name); setEditing(true); }}
          style={{
            fontSize: '14px', fontWeight: 600, marginBottom: '16px', lineHeight: 1.4,
            cursor: 'pointer', padding: '4px 8px', borderRadius: '4px',
            transition: 'background 0.15s',
          }}
          onMouseOver={e => e.target.style.background = 'var(--bg)'}
          onMouseOut={e => e.target.style.background = 'transparent'}
          title="Click to edit"
        >
          {task.fullName || task.name}
        </h3>
      )}

      <div style={{ marginBottom: '12px' }}>
        <textarea
          value={localDescription}
          onInput={e => setLocalDescription(e.target.value)}
          onBlur={() => onUpdateTask(task.id, { description: localDescription })}
          placeholder="Add a description..."
          rows="2"
          style={{
            width: '100%', fontSize: '12px', fontFamily: 'var(--font)',
            padding: '8px', border: '1px solid var(--border)', borderRadius: '6px',
            background: 'var(--bg)', resize: 'vertical', outline: 'none',
            transition: 'border-color 0.15s', lineHeight: 1.5,
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        />
      </div>

      {task.skills && task.skills.length > 0 ? (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {task.skills.map(s => (
            <span key={s} className="badge badge-accent" style={{ fontSize: '10px' }}>{s}</span>
          ))}
        </div>
      ) : null}

      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Epic</span>
        <input
          value={task.group || ''}
          onInput={e => onUpdateTask(task.id, { group: e.target.value || undefined })}
          placeholder="None"
          list="epic-list"
          style={{
            flex: 1, padding: '3px 8px', fontSize: '12px', fontFamily: 'var(--font)',
            border: '1px solid var(--border)', borderRadius: '4px',
            background: 'var(--bg)', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <datalist id="epic-list">
          {(epics || []).map(e => (
            <option key={e.name} value={e.name} />
          ))}
        </datalist>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {task.manual ? 'Steps / Notes' : 'Notes for Claude'}
        </div>
        <textarea
          value={localNote}
          onInput={e => setLocalNote(e.target.value)}
          onBlur={() => onUpdateNotes(task.id, localNote)}
          placeholder={task.manual ? 'What you need to do...' : 'Instructions for Claude...'}
          rows="4"
          style={{
            width: '100%', fontSize: '12px', fontFamily: 'var(--font)',
            padding: '8px', border: '1px solid var(--border)', borderRadius: '6px',
            background: 'var(--bg)', resize: 'vertical', outline: 'none',
            transition: 'border-color 0.15s', lineHeight: 1.5,
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        />
      </div>

      {/* Attachments section */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Screenshots
        </div>
        {attachments.length === 0 ? (
          <div style={{
            fontSize: '11px', color: 'var(--text-light)', fontStyle: 'italic',
            padding: '12px', textAlign: 'center',
            border: '1px dashed var(--border)', borderRadius: '6px',
          }}>
            Paste or drop screenshots here
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {attachments.map(att => (
              <div
                key={att.id}
                style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}
                className="attachment-thumb"
              >
                {thumbUrls[att.id] ? (
                  <img
                    src={thumbUrls[att.id]}
                    alt={att.filename}
                    style={{ display: 'block', maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', background: 'var(--bg)' }}
                  />
                ) : (
                  <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontSize: '11px', color: 'var(--text-light)' }}>
                    Loading...
                  </div>
                )}
                <div style={{
                  fontSize: '10px', color: 'var(--text-muted)', padding: '3px 6px',
                  background: 'var(--bg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {att.filename}
                </div>
                <button
                  onClick={() => onDeleteAttachment(task.id, att.id)}
                  className="attachment-delete-btn"
                  style={{
                    position: 'absolute', top: '4px', right: '4px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', color: 'white',
                    border: 'none', cursor: 'pointer', fontSize: '12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 0.15s',
                    lineHeight: 1, padding: 0, fontFamily: 'var(--font)',
                  }}
                  title="Delete attachment"
                >
                  &#215;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {(() => {
        const otherTasks = (tasks || []).filter(t => t.id !== task.id && (t.status === 'pending' || t.status === 'in-progress'));
        if (otherTasks.length === 0) return null;
        const deps = task.dependsOn || [];
        const selected = otherTasks.filter(t => deps.includes(t.id));
        const available = otherTasks.filter(t => !deps.includes(t.id));
        const toggleDep = (depId) => {
          const next = deps.includes(depId) ? deps.filter(d => d !== depId) : [...deps, depId];
          onUpdateTask(task.id, { dependsOn: next });
        };
        return (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Depends on {selected.length > 0 ? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>({selected.length})</span> : null}
            </div>
            {selected.length > 0 ? (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                {selected.map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleDep(t.id)}
                    title="Click to remove dependency"
                    style={{
                      padding: '3px 10px',
                      fontSize: '11px',
                      fontFamily: 'var(--font)',
                      fontWeight: 600,
                      borderRadius: '99px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      border: '1px solid var(--accent)',
                      background: 'var(--accent)',
                      color: 'white',
                    }}
                  >
                    {t.name} ×
                  </button>
                ))}
              </div>
            ) : null}
            {available.length > 0 ? (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {available.map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleDep(t.id)}
                    title="Click to add dependency"
                    style={{
                      padding: '3px 10px',
                      fontSize: '11px',
                      fontFamily: 'var(--font)',
                      fontWeight: 400,
                      borderRadius: '99px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      border: '1px dashed var(--border)',
                      background: 'transparent',
                      color: 'var(--text-light)',
                    }}
                  >
                    + {t.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })()}

      {(task.status === 'pending' || task.status === 'paused') && task.manual ? (
        <button
          onClick={() => onUpdateTask(task.id, { status: 'done' })}
          style={{
            width: '100%', padding: '8px 16px',
            background: 'var(--success)', color: 'white',
            border: 'none', borderRadius: 'var(--radius-sm)',
            fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font)',
            cursor: 'pointer', transition: 'opacity 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
          onMouseOver={e => e.target.style.opacity = '0.85'}
          onMouseOut={e => e.target.style.opacity = '1'}
        >
          Mark done &#10003;
        </button>
      ) : (task.status === 'pending' || task.status === 'paused') && !task.manual ? (
        <button
          onClick={() => onQueue(task)}
          style={{
            width: '100%', padding: '8px 16px',
            background: 'var(--accent)', color: 'white',
            border: 'none', borderRadius: 'var(--radius-sm)',
            fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font)',
            cursor: 'pointer', transition: 'opacity 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
          onMouseOver={e => e.target.style.opacity = '0.85'}
          onMouseOut={e => e.target.style.opacity = '1'}
        >
          Queue &#9654;
        </button>
      ) : null}

      <button
        onClick={() => { if (confirm('Delete "' + (task.fullName || task.name) + '"?')) onDeleteTask(task.id); }}
        style={{
          width: '100%', padding: '6px 16px', marginTop: '8px',
          background: 'none', color: 'var(--text-light)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          fontSize: '12px', fontFamily: 'var(--font)',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseOver={e => { e.target.style.color = 'var(--danger)'; e.target.style.borderColor = 'var(--danger)'; }}
        onMouseOut={e => { e.target.style.color = 'var(--text-light)'; e.target.style.borderColor = 'var(--border)'; }}
      >Delete task</button>
    </div>
  );
}
