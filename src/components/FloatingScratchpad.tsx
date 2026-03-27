import React from 'react';
import { Scratchpad } from './Scratchpad.tsx';

interface FloatingScratchpadProps {
  show: boolean;
  onToggle: () => void;
  scratchpadValue: string;
  onScratchpadChange: (text: string) => void;
  onSplit: (text: string) => void;
  splitting: boolean;
}

export function FloatingScratchpad({ show, onToggle, scratchpadValue, onScratchpadChange, onSplit, splitting }: FloatingScratchpadProps) {
  return (
    <>
      <button
        onClick={onToggle}
        title="Scratchpad"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 50,
          width: '48px', height: '48px', borderRadius: '50%',
          background: scratchpadValue ? 'var(--dm-amber)' : 'var(--dm-accent)',
          color: '#fff', border: 'none', cursor: 'pointer',
          fontSize: '20px', lineHeight: 1,
          boxShadow: 'var(--dm-shadow-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s',
          transform: show ? 'rotate(45deg)' : 'none',
        }}
      >{show ? '+' : '\u270E'}</button>

      {show && (
        <div style={{
          position: 'fixed', bottom: '84px', right: '24px', zIndex: 50,
          width: '400px', height: '60vh',
          background: 'var(--dm-surface)',
          border: '1px solid var(--dm-border)',
          borderRadius: 'var(--dm-radius)',
          boxShadow: 'var(--dm-shadow-md)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--dm-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--dm-text)' }}>Scratchpad</span>
            <button onClick={onToggle} className="btn-ghost" style={{ fontSize: '16px', padding: '2px 6px' }}>×</button>
          </div>
          <div style={{ padding: '12px 14px', flex: 1, overflow: 'auto' }}>
            <Scratchpad
              value={scratchpadValue}
              onChange={onScratchpadChange}
              onSplit={onSplit}
              splitting={splitting}
            />
          </div>
        </div>
      )}
    </>
  );
}
