import React from 'react';
import { UNDO_BUTTON } from '../constants/strings.ts';

import type { UndoEntry } from '../types';

interface UndoToastProps {
  entry: UndoEntry | null;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ entry, onUndo, onDismiss }: UndoToastProps) {
  const visible = !!entry;

  if (!entry && !visible) return null;

  return (
    <div className="undo-toast fixed flex-center gap-12 text-13" style={{
      bottom: '24px',
      left: '50%',
      transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(20px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.2s ease, opacity 0.2s ease',
      zIndex: 1000,
      padding: '10px 16px',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <span className="text-muted">{entry?.label}</span>
      <button
        onClick={onUndo}
        className="btn-undo text-13"
        style={{ padding: '2px 8px' }}
      >
        {UNDO_BUTTON}
      </button>
      <button
        onClick={onDismiss}
        className="btn-icon text-16"
        style={{ padding: '2px 4px' }}
      >
        ×
      </button>
    </div>
  );
}
