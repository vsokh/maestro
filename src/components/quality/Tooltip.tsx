import React, { useRef, useState } from 'react';

export function Tooltip({ text, children, style: wrapStyle }: { text: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
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
        <div className="tooltip-popup fixed text-12 leading-normal" style={{
          left: pos.x, top: pos.y,
          transform: 'translateX(-50%)',
          zIndex: 1000,
          maxWidth: 360, padding: '8px 12px',
        }}>
          {text}
        </div>
      )}
    </>
  );
}

export function TrendArrow({ trend }: { trend: string }) {
  if (trend === 'up') return <span className="text-success text-14">&#9650;</span>;
  if (trend === 'down') return <span className="text-danger text-14">&#9660;</span>;
  return <span className="text-light text-14">&#8212;</span>;
}

export function Pill({ ok, warn, children }: { ok?: boolean; warn?: boolean; children: React.ReactNode }) {
  const bg = ok ? 'var(--dm-success-light)' : warn ? 'var(--dm-amber-light)' : 'var(--dm-danger-light)';
  const dot = ok ? 'var(--dm-success)' : warn ? 'var(--dm-amber)' : 'var(--dm-danger)';
  return (
    <span className="inline-flex items-center text-12 font-500" style={{
      gap: 5,
      padding: '4px 10px', borderRadius: 16,
      background: bg,
    }}>
      <span className="shrink-0" style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />
      {children}
    </span>
  );
}
