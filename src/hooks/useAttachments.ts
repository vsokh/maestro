import type { Task } from '../types';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api.ts';

/**
 * Custom hook for attachment drag/drop/paste handling.
 * Returns state and event handlers that TaskDetail attaches to its wrapper div.
 */
export function useAttachments(task: Task | null, onAddAttachment: (taskId: number, file: File) => void) {
  const [pastedFeedback, setPastedFeedback] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const dragCounter = useRef(0);

  // Build thumbnail URLs when task/attachments change
  // These are now simple HTTP URLs, no blob URL management needed
  useEffect(() => {
    if (!task?.attachments?.length) {
      setThumbUrls({});
      return;
    }
    const urls: Record<string, string> = {};
    for (const att of task.attachments) {
      urls[att.id] = api.getAttachmentUrl(task.id, att.filename);
    }
    setThumbUrls(urls);
    // No cleanup needed — these are regular URLs, not blob URLs
  }, [task]);

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
