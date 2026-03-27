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
        className="fixed flex-center justify-center border-none cursor-pointer text-20"
        style={{
          bottom: '24px', right: '24px', zIndex: 50,
          width: '48px', height: '48px', borderRadius: '50%',
          background: scratchpadValue ? 'var(--dm-amber)' : 'var(--dm-accent)',
          color: '#fff',
          lineHeight: 1,
          boxShadow: 'var(--dm-shadow-md)',
          transition: 'transform 0.2s',
          transform: show ? 'rotate(45deg)' : 'none',
        }}
      >{show ? '+' : '\u270E'}</button>

      {show && (
        <div className="fixed flex-col overflow-hidden" style={{
          bottom: '84px', right: '24px', zIndex: 50,
          width: '400px', height: '60vh',
          background: 'var(--dm-surface)',
          border: '1px solid var(--dm-border)',
          borderRadius: 'var(--dm-radius)',
          boxShadow: 'var(--dm-shadow-md)',
        }}>
          <div className="flex-between" style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--dm-border)',
          }}>
            <span className="font-700 text-13" style={{ color: 'var(--dm-text)' }}>Scratchpad</span>
            <button onClick={onToggle} className="btn-ghost text-16" style={{ padding: '2px 6px' }}>×</button>
          </div>
          <div className="flex-1 overflow-auto" style={{ padding: '12px 14px' }}>
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
