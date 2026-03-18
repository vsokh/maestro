import React, { useState, useCallback } from 'react';
import {
  APP_NAME, HEADER_DISCONNECT_ARIA, HEADER_SWITCH_PROJECT, HEADER_SYNCED,
  HEADER_SYNC_ERROR, HEADER_CONNECTED, HEADER_TOGGLE_THEME_ARIA,
  HEADER_LIGHT_MODE, HEADER_DARK_MODE,
} from '../constants/strings.ts';

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
          aria-label={HEADER_DISCONNECT_ARIA}
          title={HEADER_SWITCH_PROJECT}
          className="btn-ghost"
          style={{ fontSize: '14px', padding: '2px 6px', borderRadius: '4px' }}
        >←</button>
        <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--dm-text)' }}>{projectName}</span>
        <div className={`dot-sync ${status === 'error' ? 'dot-sync--error' : 'dot-sync--ok'}`} style={{ flexShrink: 0 }} title={status === 'error' ? HEADER_SYNC_ERROR : HEADER_CONNECTED} />
        <span className="text-light" style={{ fontSize: '14px' }}>/</span>
        <span className="text-muted" style={{ fontWeight: 500, fontSize: '16px' }}>{APP_NAME}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {status === 'synced' ? (
          <span className="text-accent" style={{ fontSize: '12px', fontWeight: 500 }}>
            {HEADER_SYNCED}
          </span>
        ) : status === 'error' ? (
          <span className="text-danger" style={{ fontSize: '11px' }}>{HEADER_SYNC_ERROR}</span>
        ) : null}
        <button
          onClick={toggleTheme}
          aria-label={HEADER_TOGGLE_THEME_ARIA}
          title={dark ? HEADER_LIGHT_MODE : HEADER_DARK_MODE}
          className="btn-theme-toggle"
          style={{ fontSize: '16px', padding: '4px', lineHeight: 1 }}
        >{dark ? '☀' : '☽'}</button>
      </div>
    </header>
  );
}
