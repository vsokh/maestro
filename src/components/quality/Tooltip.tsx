import React, { useRef, useState } from 'react';

export function Tooltip({ text, children, style: wrapStyle }: { text: string; children: React.ReactNode; style?: React.CSSProperties }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  const handleEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
    setShow(true);
  };

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setShow(false)}
        style={{ cursor: 'help', borderBottom: '1px dashed var(--dm-border)', ...wrapStyle }}
      >
        {children}
      </span>
      {show && (
        <div className="tooltip-popup" style={{
          position: 'fixed', left: pos.x, top: pos.y,
          transform: 'translateX(-50%)',
          zIndex: 1000,
          maxWidth: 300, padding: '8px 12px',
          fontSize: 12, lineHeight: 1.5,
        }}>
          {text}
        </div>
      )}
    </>
  );
}

export function TrendArrow({ trend }: { trend: string }) {
  if (trend === 'up') return <span className="text-success" style={{ fontSize: 14 }}>&#9650;</span>;
  if (trend === 'down') return <span className="text-danger" style={{ fontSize: 14 }}>&#9660;</span>;
  return <span className="text-light" style={{ fontSize: 14 }}>&#8212;</span>;
}

export function Pill({ ok, warn, children }: { ok?: boolean; warn?: boolean; children: React.ReactNode }) {
  const bg = ok ? 'var(--dm-success-light)' : warn ? 'var(--dm-amber-light)' : 'rgba(196,122,122,0.12)';
  const dot = ok ? 'var(--dm-success)' : warn ? 'var(--dm-amber)' : 'var(--dm-danger)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 500,
      background: bg,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      {children}
    </span>
  );
}
