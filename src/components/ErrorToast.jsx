import React, { useEffect, useState } from 'react';

export function ErrorToast({ message, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [message]);

  if (!message && !visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '64px',
      left: '50%',
      transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(20px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.2s ease, opacity 0.2s ease',
      zIndex: 1001,
      background: 'var(--dm-surface)',
      border: '1px solid var(--dm-danger)',
      borderRadius: 'var(--dm-radius-sm)',
      boxShadow: 'var(--dm-shadow-md)',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '13px',
      color: 'var(--dm-text)',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <span style={{ color: 'var(--dm-danger)', fontWeight: 600 }}>{message}</span>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--dm-text-light)',
          cursor: 'pointer',
          padding: '2px 4px',
          fontSize: '16px',
          lineHeight: 1,
          fontFamily: 'inherit',
        }}
      >
        &#215;
      </button>
    </div>
  );
}
