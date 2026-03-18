import React, { useState, useCallback } from 'react';

interface HeaderProps {
  projectName: string;
  status: string;
  onDisconnect: () => void;
}

export function Header({ projectName, status, onDisconnect }: HeaderProps) {
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');

  const toggleTheme = useCallback(() => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('dm_theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('dm_theme', 'light');
    }
  }, [dark]);

  return (
    <header className="dm-header header" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onDisconnect}
          aria-label="Disconnect project"
          title="Switch project"
          className="btn-ghost"
          style={{ fontSize: '14px', padding: '2px 6px', borderRadius: '4px' }}
        >←</button>
        <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--dm-text)' }}>{projectName}</span>
        <div className={`dot-sync ${status === 'error' ? 'dot-sync--error' : 'dot-sync--ok'}`} style={{ flexShrink: 0 }} title={status === 'error' ? 'Sync error' : 'Connected'} />
        <span className="text-light" style={{ fontSize: '14px' }}>/</span>
        <span className="text-muted" style={{ fontWeight: 500, fontSize: '16px' }}>Dev Manager</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {status === 'synced' ? (
          <span className="text-accent" style={{ fontSize: '12px', fontWeight: 500 }}>
            Synced from Claude!
          </span>
        ) : status === 'error' ? (
          <span className="text-danger" style={{ fontSize: '11px' }}>Sync error</span>
        ) : null}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={dark ? 'Light mode' : 'Dark mode'}
          className="btn-theme-toggle"
          style={{ fontSize: '16px', padding: '4px', lineHeight: 1 }}
        >{dark ? '☀' : '☽'}</button>
      </div>
    </header>
  );
}
