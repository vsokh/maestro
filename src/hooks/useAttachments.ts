import type { Task } from '../types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { readAttachmentUrl } from '../fs.ts';

/**
 * Custom hook for attachment drag/drop/paste handling.
 * Returns state and event handlers that TaskDetail attaches to its wrapper div.
 */
export function useAttachments(task: Task | null, dirHandle: FileSystemDirectoryHandle | null, onAddAttachment: (taskId: number, file: File) => void) {
  const [pastedFeedback, setPastedFeedback] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const dragCounter = useRef(0);
  const thumbUrlsRef = useRef<Record<string, string>>({});

  // Keep ref in sync with state (via effect, not render)
  useEffect(() => {
    thumbUrlsRef.current = thumbUrls;
  }, [thumbUrls]);

  // Load thumbnail URLs when task/attachments change
  useEffect(() => {
    if (!task || !dirHandle || !task.attachments?.length) return;

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
  }, [task, dirHandle]);

  // Clean up thumb URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(thumbUrlsRef.current).forEach((u) => { try { URL.revokeObjectURL(u as string); } catch (err) { console.warn('revokeObjectURL failed:', err); } });
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
  }, [task, onAddAttachment]);

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
    thumbUrls: (!task || !task.attachments?.length) ? {} : thumbUrls,
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
