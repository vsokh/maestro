import React, { useEffect, useState } from 'react';

import type { UndoEntry } from '../types';

interface UndoToastProps {
  entry: UndoEntry | null;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ entry, onUndo, onDismiss }: UndoToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (entry) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [entry]);

  if (!entry && !visible) return null;

  return (
    <div className="undo-toast" style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(20px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.2s ease, opacity 0.2s ease',
      zIndex: 1000,
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '13px',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <span className="text-muted">{entry?.label}</span>
      <button
        onClick={onUndo}
        className="btn-undo"
        style={{ fontSize: '13px', padding: '2px 8px' }}
      >
        Undo
      </button>
      <button
        onClick={onDismiss}
        className="btn-icon"
        style={{ padding: '2px 4px', fontSize: '16px' }}
      >
        ×
      </button>
    </div>
  );
}
