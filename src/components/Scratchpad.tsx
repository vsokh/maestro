import React, { useState, useRef, useEffect } from 'react';

interface ScratchpadProps {
  value: string;
  onChange: (value: string) => void;
  onSplit: (text: string) => void;
  splitting: boolean;
}

export function Scratchpad({ value, onChange, onSplit, splitting }: ScratchpadProps) {
  const [localValue, setLocalValue] = useState(value);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync from parent when external changes come in
  useEffect(() => { setLocalValue(value); }, [value]);

  const handleChange = (text: string) => {
    setLocalValue(text);
    // Debounce save
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onChange(text), 500);
  };

  const handleSplit = () => {
    if (!localValue.trim()) return;
    onSplit(localValue.trim());
  };

  const lineCount = (localValue || '').split('\n').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <textarea
        ref={textareaRef}
        value={localValue}
        onChange={e => handleChange(e.target.value)}
        placeholder="Jot down bugs, ideas, observations as you test...&#10;&#10;Example:&#10;- toast has a black border on mobile&#10;- notification click freezes for 2s&#10;- would be nice to have dark mode&#10;&#10;Then hit 'Split into tasks' to create individual tasks."
        style={{
          flex: 1,
          width: '100%',
          background: 'var(--dm-bg)',
          color: 'var(--dm-text)',
          border: '1px solid var(--dm-border)',
          borderRadius: 'var(--dm-radius-sm)',
          padding: '10px 12px',
          fontSize: '13px',
          lineHeight: 1.6,
          resize: 'none',
          fontFamily: 'inherit',
          outline: 'none',
          minHeight: '80px',
        }}
      />
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: '8px', gap: '8px',
      }}>
        <span className="text-muted" style={{ fontSize: '11px' }}>
          {localValue.trim() ? `${lineCount} line${lineCount > 1 ? 's' : ''}` : 'Empty'}
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          {localValue.trim() && (
            <button
              onClick={() => { handleChange(''); }}
              className="btn-ghost"
              style={{ fontSize: '12px', padding: '4px 10px', color: 'var(--dm-text-muted)' }}
            >Clear</button>
          )}
          <button
            onClick={handleSplit}
            disabled={!localValue.trim() || splitting}
            className="btn-ghost"
            style={{
              fontSize: '12px', padding: '4px 12px',
              fontWeight: 600,
              color: localValue.trim() && !splitting ? 'var(--dm-accent)' : 'var(--dm-text-muted)',
              border: `1px solid ${localValue.trim() && !splitting ? 'var(--dm-accent)' : 'var(--dm-border)'}`,
              borderRadius: '4px',
              opacity: splitting ? 0.6 : 1,
            }}
          >{splitting ? 'Splitting...' : 'Split into tasks'}</button>
        </div>
      </div>
    </div>
  );
}
