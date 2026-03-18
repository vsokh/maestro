import { useState, useCallback, useRef } from 'react';
import { snapshotState } from '../fs.ts';
import type { StateData, UndoEntry } from '../types';

interface UseUndoParams {
  data: StateData | null;
  save: (data: StateData) => void;
  dirHandle: FileSystemDirectoryHandle | null;
  showError: (msg: string) => void;
}

export function useUndo({ data, save, dirHandle, showError }: UseUndoParams) {
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapshotBeforeAction = useCallback((label: string) => {
    if (dirHandle && data) {
      snapshotState(dirHandle, showError);
    }
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoEntry({ data: structuredClone(data) as StateData, label, timestamp: Date.now() });
    undoTimer.current = setTimeout(() => setUndoEntry(null), 8000);
  }, [dirHandle, data, showError]);

  const handleUndo = useCallback(() => {
    if (!undoEntry) return;
    save(undoEntry.data);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoEntry(null);
  }, [undoEntry, save]);

  const dismissUndo = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoEntry(null);
  }, []);

  return { undoEntry, snapshotBeforeAction, handleUndo, dismissUndo };
}
