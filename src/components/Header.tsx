import React, { useState, useCallback } from 'react';
import {
  APP_NAME, HEADER_SYNCED,
  HEADER_SYNC_ERROR, HEADER_CONNECTED, HEADER_TOGGLE_THEME_ARIA,
  HEADER_LIGHT_MODE, HEADER_DARK_MODE,
  HEADER_ENGINE_ARIA, HEADER_ENGINE_TITLE,
} from '../constants/strings.ts';
import { ENGINES, getEngine } from '../constants/engines.ts';

interface ProjectInfo {
  path: string;
  name: string;
  active: boolean;
}

interface HeaderProps {
  projectName: string;
  status: string;
  projects?: ProjectInfo[];
  onSwitchProject?: (path: string) => void;
  onOpenSkills?: () => void;
  defaultEngine?: string;
  onSetDefaultEngine?: (engineId: string) => void;
}

export function Header({ projectName, status, projects, onSwitchProject, onOpenSkills, defaultEngine, onSetDefaultEngine }: HeaderProps) {
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');
  const [showPicker, setShowPicker] = useState(false);

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

  const hasMultipleProjects = projects && projects.length > 1;
  const currentEngine = getEngine(defaultEngine);

  return (
    <header className="dm-header header" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
        {hasMultipleProjects && (
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="btn-ghost"
            title="Switch project"
            style={{ fontSize: '14px', padding: '2px 6px', borderRadius: '4px' }}
          >{showPicker ? '×' : '⇄'}</button>
        )}
        <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--dm-text)' }}>{projectName}</span>
        <div className={`dot-sync ${status === 'error' ? 'dot-sync--error' : 'dot-sync--ok'}`} style={{ flexShrink: 0 }} title={status === 'error' ? HEADER_SYNC_ERROR : HEADER_CONNECTED} />
        <span className="text-light" style={{ fontSize: '14px' }}>/</span>
        <span className="text-muted" style={{ fontWeight: 500, fontSize: '16px' }}>{APP_NAME}</span>

        {showPicker && hasMultipleProjects && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: '8px',
            background: 'var(--dm-surface)', border: '1px solid var(--dm-border)',
            borderRadius: 'var(--dm-radius)', boxShadow: 'var(--dm-shadow-sm)',
            padding: '4px 0', minWidth: '200px', zIndex: 100,
          }}>
            {projects!.map(p => (
              <button
                key={p.path}
                onClick={() => {
                  if (!p.active && onSwitchProject) {
                    onSwitchProject(p.path);
                  }
                  setShowPicker(false);
                }}
                className="btn-ghost"
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 16px', fontSize: '14px', borderRadius: 0,
                  fontWeight: p.active ? 700 : 400,
                  color: p.active ? 'var(--dm-accent)' : 'var(--dm-text)',
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {status === 'synced' ? (
          <span className="text-accent" style={{ fontSize: '12px', fontWeight: 500 }}>
            {HEADER_SYNCED}
          </span>
        ) : status === 'error' ? (
          <span className="text-danger" style={{ fontSize: '11px' }}>{HEADER_SYNC_ERROR}</span>
        ) : null}
        {onOpenSkills && (
          <button
            onClick={onOpenSkills}
            aria-label="Skill categories"
            title="Configure skill categories"
            className="btn-ghost"
            style={{ fontSize: '14px', padding: '4px 6px' }}
          >&#9881;</button>
        )}
        {onSetDefaultEngine ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                fontSize: '14px',
                lineHeight: 1,
                color: currentEngine.color,
              }}
              title={HEADER_ENGINE_TITLE}
            >{currentEngine.icon}</span>
            <select
              aria-label={HEADER_ENGINE_ARIA}
              title={HEADER_ENGINE_TITLE}
              value={currentEngine.id}
              onChange={(e) => onSetDefaultEngine(e.target.value)}
              className="select-field"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 18px 2px 4px',
                borderRadius: '4px',
                background: 'transparent',
                color: currentEngine.color,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {ENGINES.map(eng => (
                <option key={eng.id} value={eng.id} style={{ background: 'var(--dm-surface)' }}>
                  {eng.label}
                </option>
              ))}
            </select>
          </div>
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
