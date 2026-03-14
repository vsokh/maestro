import React, { useState, useCallback } from 'react';

export function Header({ projectName, status, onDisconnect }) {
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
    <header className="dm-header" style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: 'var(--shadow-sm)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onDisconnect}
          title="Switch project"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-light)', fontSize: '14px', fontFamily: 'var(--font)',
            padding: '2px 6px', borderRadius: '4px', transition: 'all 0.15s',
          }}
          onMouseOver={e => { e.target.style.color = 'var(--accent)'; e.target.style.background = 'var(--accent-light)'; }}
          onMouseOut={e => { e.target.style.color = 'var(--text-light)'; e.target.style.background = 'none'; }}
        >←</button>
        <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text)' }}>{projectName}</span>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: status === 'error' ? 'var(--danger)' : 'var(--success)', flexShrink: 0 }} title={status === 'error' ? 'Sync error' : 'Connected'} />
        <span style={{ color: 'var(--text-light)', fontSize: '14px' }}>/</span>
        <span style={{ fontWeight: 500, fontSize: '16px', color: 'var(--text-muted)' }}>Dev Manager</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {status === 'synced' ? (
          <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>
            Synced from Claude!
          </span>
        ) : status === 'error' ? (
          <span style={{ fontSize: '11px', color: 'var(--danger)' }}>Sync error</span>
        ) : null}
        <button
          onClick={toggleTheme}
          title={dark ? 'Light mode' : 'Dark mode'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '16px', padding: '4px', lineHeight: 1,
            color: 'var(--text-light)', transition: 'color 0.15s',
          }}
          onMouseOver={e => e.target.style.color = 'var(--text)'}
          onMouseOut={e => e.target.style.color = 'var(--text-light)'}
        >{dark ? '☀' : '☽'}</button>
      </div>
    </header>
  );
}
