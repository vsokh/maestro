import { useState, useEffect, useRef, useCallback } from 'react';
import { readAttachmentUrl } from '../../fs.js';

/**
 * Custom hook for attachment drag/drop/paste handling.
 * Returns state and event handlers that TaskDetail attaches to its wrapper div.
 */
export function useAttachments(task, dirHandle, onAddAttachment) {
  const [pastedFeedback, setPastedFeedback] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [thumbUrls, setThumbUrls] = useState({});
  const dragCounter = useRef(0);

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
      Object.values(urls).forEach(u => { try { URL.revokeObjectURL(u); } catch (err) { console.warn('revokeObjectURL failed:', err); } });
    };
  }, [task?.id, task?.attachments, dirHandle]);

  // Clean up thumb URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(thumbUrls).forEach(u => { try { URL.revokeObjectURL(u); } catch (err) { console.warn('revokeObjectURL failed:', err); } });
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

  return {
    thumbUrls,
    pastedFeedback,
    dragging,
    handlers: {
      onPaste: handlePaste,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  };
}

/**
 * Display component for the attachments/screenshots list.
 */
export function AttachmentsList({ task, thumbUrls, onDeleteAttachment }) {
  const attachments = task.attachments || [];

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--dm-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Screenshots
      </div>
      {attachments.length === 0 ? (
        <div style={{
          fontSize: '11px', color: 'var(--dm-text-light)', fontStyle: 'italic',
          padding: '12px', textAlign: 'center',
          border: '1px dashed var(--dm-border)', borderRadius: '6px',
        }}>
          Paste or drop screenshots here
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {attachments.map(att => (
            <div
              key={att.id}
              style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--dm-border)' }}
              className="attachment-thumb"
            >
              {thumbUrls[att.id] ? (
                <img
                  src={thumbUrls[att.id]}
                  alt={att.filename}
                  style={{ display: 'block', maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', background: 'var(--dm-bg)' }}
                />
              ) : (
                <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--dm-bg)', fontSize: '11px', color: 'var(--dm-text-light)' }}>
                  Loading...
                </div>
              )}
              <div style={{
                fontSize: '10px', color: 'var(--dm-text-muted)', padding: '3px 6px',
                background: 'var(--dm-bg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {att.filename}
              </div>
              <button
                onClick={() => onDeleteAttachment(task.id, att.id)}
                className="attachment-delete-btn"
                style={{
                  position: 'absolute', top: '4px', right: '4px',
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'var(--dm-overlay-dark)', color: 'white',
                  border: 'none', cursor: 'pointer', fontSize: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.15s',
                  lineHeight: 1, padding: 0, fontFamily: 'var(--dm-font)',
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
  );
}
