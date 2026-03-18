import React, { useEffect, useState } from 'react';

interface ErrorToastProps {
  message: string | null;
  onDismiss: () => void;
}

export function ErrorToast({ message, onDismiss }: ErrorToastProps) {
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
    <div className="error-toast" style={{
      position: 'fixed',
      bottom: '64px',
      left: '50%',
      transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(20px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.2s ease, opacity 0.2s ease',
      zIndex: 1001,
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '13px',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <span className="text-danger" style={{ fontWeight: 600 }}>{message}</span>
      <button
        onClick={onDismiss}
        className="btn-icon"
        style={{ padding: '2px 4px', fontSize: '16px' }}
      >
        &#215;
      </button>
    </div>
  );
}
