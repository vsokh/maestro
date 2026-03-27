import React, { useState, useRef, useEffect } from 'react';

interface ScratchpadProps {
  value: string;
  onChange: (value: string) => void;
  onSplit: (text: string) => void;
  splitting: boolean;
}

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*<>{}[]|/\\~';

function scrambleText(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    // Preserve whitespace (spaces, tabs, newlines) for structure
    if (/\s/.test(ch)) {
      result += ch;
    } else {
      result += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
    }
  }
  return result;
}

export function Scratchpad({ value, onChange, onSplit, splitting }: ScratchpadProps) {
  const [localValue, setLocalValue] = useState(value);
  const [progress, setProgress] = useState(0);
  const [scrambledText, setScrambledText] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync from parent when external changes come in
  useEffect(() => { setLocalValue(value); }, [value]);

  // Animated progress bar: eases toward 90% while splitting, snaps to 100% on done
  useEffect(() => {
    if (splitting) {
      setProgress(0);
      const start = Date.now();
      progressTimer.current = setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        // Asymptotic ease: approaches 90% over ~15s, never reaches it
        setProgress(Math.min(90, 90 * (1 - Math.exp(-elapsed / 5))));
      }, 50);
    } else {
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      if (progress > 0) {
        // Snap to 100%, then fade out
        setProgress(100);
        setTimeout(() => setProgress(0), 1200);
      }
    }
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [splitting]);

  // Signal decode: brief text scramble when splitting starts
  useEffect(() => {
    if (!splitting) return;
    const text = localValue;
    if (!text.trim()) return;

    // Immediately show first scrambled frame
    setScrambledText(scrambleText(text));

    const interval = setInterval(() => {
      setScrambledText(scrambleText(text));
    }, 30);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setScrambledText(null);
    }, 200);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      setScrambledText(null);
    };
  }, [splitting]);

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
    <div className="flex-col h-full">
      <textarea
        ref={textareaRef}
        value={scrambledText ?? localValue}
        onChange={e => handleChange(e.target.value)}
        readOnly={scrambledText !== null}
        placeholder={"Write what you found while testing:\n\n- login button doesn't work on Safari\n- profile page loads slow (3+ seconds)\n- need a way to export data as CSV\n- typo on settings page: 'Notifcations'\n\nClick 'Split into tasks' when ready."}
        className="flex-1 w-full text-13 leading-relaxed outline-none"
        style={{
          background: 'var(--dm-bg)',
          color: 'var(--dm-text)',
          border: '1px solid var(--dm-border)',
          borderRadius: 'var(--dm-radius-sm)',
          padding: '10px 12px',
          resize: 'none',
          fontFamily: 'inherit',
          minHeight: '80px',
        }}
      />
      {/* Progress bar */}
      {progress > 0 && (
        <div className="mt-8 overflow-hidden" style={{
          height: '3px',
          background: 'var(--dm-border)',
          borderRadius: '2px',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: progress >= 100 ? 'var(--dm-success)' : 'var(--dm-accent)',
            borderRadius: '2px',
            transition: progress >= 100 ? 'width 0.3s ease, background 0.3s ease' : 'width 0.15s linear',
          }} />
        </div>
      )}
      <div className="flex-between gap-8" style={{
        marginTop: progress > 0 ? '4px' : '8px',
      }}>
        <span className="text-muted text-11">
          {localValue.trim() ? `${lineCount} line${lineCount > 1 ? 's' : ''}` : 'Empty'}
        </span>
        <div className="flex gap-6">
          {localValue.trim() && (
            <button
              onClick={() => { handleChange(''); }}
              className="btn-ghost text-12"
              style={{ padding: '4px 10px', color: 'var(--dm-text-muted)' }}
            >Clear</button>
          )}
          <button
            onClick={handleSplit}
            disabled={!localValue.trim() || splitting}
            className="btn-ghost text-12 font-600"
            style={{
              padding: '4px 12px',
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
