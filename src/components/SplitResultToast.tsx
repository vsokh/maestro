import React, { useState, useEffect } from 'react';

interface SplitResultToastProps {
  tasks: { name: string }[] | null;
  onDismiss: () => void;
}

export function SplitResultToast({ tasks, onDismiss }: SplitResultToastProps) {
  const visible = !!tasks && tasks.length > 0;

  if (!tasks && !visible) return null;

  return (
    <div className="split-result-toast fixed flex-col gap-8 text-13" style={{
      bottom: '24px',
      left: '50%',
      transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(20px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.2s ease, opacity 0.2s ease',
      zIndex: 1000,
      padding: '12px 16px',
      pointerEvents: visible ? 'auto' : 'none',
      minWidth: '240px',
      maxWidth: '360px',
    }}>
      <div className="flex-between gap-12">
        <span className="font-600">
          {'\u2713'} {tasks?.length} task{tasks && tasks.length !== 1 ? 's' : ''} created
        </span>
        <button
          onClick={onDismiss}
          className="btn-icon text-16 shrink-0"
          style={{ padding: '2px 4px' }}
        >
          &#215;
        </button>
      </div>
      {tasks && tasks.length > 0 && (
        <ul style={{
          margin: 0,
          padding: '0 0 0 16px',
          listStyle: 'disc',
          maxHeight: tasks.length > 6 ? '150px' : undefined,
          overflowY: tasks.length > 6 ? 'auto' : undefined,
        }}>
          {tasks.map((t, i) => (
            <li key={i} className="text-muted" style={{ padding: '1px 0' }}>{t.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
