import type { Task } from '../../types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { readAttachmentUrl } from '../../fs.ts';
import {
  ATTACHMENTS_TITLE, ATTACHMENTS_PLACEHOLDER, ATTACHMENTS_LOADING,
  ATTACHMENTS_DELETE_ARIA, ATTACHMENTS_DELETE_TITLE,
} from '../../constants/strings.ts';

/**
 * Custom hook for attachment drag/drop/paste handling.
 * Returns state and event handlers that TaskDetail attaches to its wrapper div.
 */
export function useAttachments(task: Task | null, dirHandle: FileSystemDirectoryHandle | null, onAddAttachment: (taskId: number, file: File) => void) {
  const [pastedFeedback, setPastedFeedback] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const dragCounter = useRef(0);

  // Load thumbnail URLs when task/attachments change
  useEffect(() => {
    if (!task || !dirHandle || !task.attachments?.length) {
      setThumbUrls({});
      return;
    }

    let cancelled = false;
    const urls: Record<string, string> = {};

    (async () => {
      for (const att of task.attachments!) {
        if (cancelled) break;
        const url = await readAttachmentUrl(dirHandle, task.id, att.filename);
        if (url) urls[att.id] = url;
      }
      if (!cancelled) setThumbUrls(urls);
    })();

    return () => {
      cancelled = true;
      // Revoke old URLs to prevent memory leaks
      Object.values(urls).forEach((u) => { try { URL.revokeObjectURL(u as string); } catch (err) { console.warn('revokeObjectURL failed:', err); } });
    };
  }, [task?.id, task?.attachments, dirHandle]);

  // Clean up thumb URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(thumbUrls).forEach((u) => { try { URL.revokeObjectURL(u as string); } catch (err) { console.warn('revokeObjectURL failed:', err); } });
    };
  }, []);

  const handleImageFile = useCallback((file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'png';
    const filename = `screenshot-${Date.now()}.${ext}`;
    const renamedFile = new File([file], filename, { type: file.type });
    onAddAttachment(task!.id, renamedFile);
    setPastedFeedback(true);
    setTimeout(() => setPastedFeedback(false), 1500);
  }, [task?.id, onAddAttachment]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
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

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
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
interface AttachmentsListProps {
  task: Task;
  thumbUrls: Record<string, string>;
  onDeleteAttachment: (taskId: number, attachmentId: string) => void;
}

export function AttachmentsList({ task, thumbUrls, onDeleteAttachment }: AttachmentsListProps) {
  const attachments = task.attachments || [];

  return (
    <div style={{ marginBottom: '16px' }}>
      <div className="label" style={{ marginBottom: '6px' }}>
        {ATTACHMENTS_TITLE}
      </div>
      {attachments.length === 0 ? (
        <div className="attachment-placeholder" style={{ padding: '12px' }}>
          {ATTACHMENTS_PLACEHOLDER}
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
                  {ATTACHMENTS_LOADING}
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
                aria-label={ATTACHMENTS_DELETE_ARIA}
                className="attachment-delete-btn attachment-delete"
                style={{
                  position: 'absolute', top: '4px', right: '4px',
                  width: '20px', height: '20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, fontSize: '12px', lineHeight: 1, padding: 0,
                }}
                title={ATTACHMENTS_DELETE_TITLE}
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
