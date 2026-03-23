import React, { useState, useCallback, useEffect } from 'react';
import {
  APP_NAME, HEADER_SYNCED,
  HEADER_SYNC_ERROR, HEADER_CONNECTED, HEADER_TOGGLE_THEME_ARIA,
  HEADER_LIGHT_MODE, HEADER_DARK_MODE,
  HEADER_ENGINE_ARIA, HEADER_ENGINE_TITLE,
} from '../constants/strings.ts';
import { ENGINES, getEngine } from '../constants/engines.ts';
import { api } from '../api.ts';

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
  const [unpushed, setUnpushed] = useState(0);
  const [commits, setCommits] = useState<Array<{ hash: string; message: string }>>([]);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);
  const [showPushDetails, setShowPushDetails] = useState(false);

  // Poll for unpushed commits
  useEffect(() => {
    if (status !== 'connected' && status !== 'synced') return;
    const check = () => { api.gitStatus().then(r => { setUnpushed(r.unpushed || 0); setCommits(r.commits || []); }).catch(() => {}); };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [status, projectName]);

  const handlePush = useCallback(async () => {
    setPushing(true);
    setPushResult(null);
    setShowPushDetails(false);
    try {
      await api.gitPush();
      setUnpushed(0);
      setCommits([]);
      setPushResult('Pushed!');
      setTimeout(() => setPushResult(null), 3000);
    } catch (err: any) {
      setPushResult('Push failed');
      setTimeout(() => setPushResult(null), 5000);
    } finally {
      setPushing(false);
    }
  }, []);

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
        {onSwitchProject && (
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

        {showPicker && onSwitchProject && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: '8px',
            background: 'var(--dm-surface)', border: '1px solid var(--dm-border)',
            borderRadius: 'var(--dm-radius)', boxShadow: 'var(--dm-shadow-md)',
            padding: '4px 0', minWidth: '280px', zIndex: 100,
          }}>
            {projects && projects.map(p => (
              <button
                key={p.path}
                onClick={() => {
                  if (!p.active) onSwitchProject(p.path);
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
                {p.active && <span style={{ fontSize: '11px', marginLeft: '8px', opacity: 0.5 }}>current</span>}
              </button>
            ))}
            <div style={{
              borderTop: '1px solid var(--dm-border)',
              padding: '8px 12px',
            }}>
              <button
                onClick={async () => {
                  setShowPicker(false);
                  try {
                    const result = await api.browseNative();
                    if (result.path && onSwitchProject) onSwitchProject(result.path);
                  } catch { /* user cancelled or error */ }
                }}
                className="btn-ghost"
                style={{
                  width: '100%', fontSize: '13px', padding: '6px 12px',
                  fontWeight: 600, color: 'var(--dm-accent)',
                  border: '1px solid var(--dm-accent)', borderRadius: '4px',
                }}
              >Open folder...</button>
            </div>
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
        {unpushed > 0 && (
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <button
                onClick={() => setShowPushDetails(!showPushDetails)}
                className="btn-ghost"
                style={{
                  fontSize: '12px', padding: '3px 8px',
                  fontWeight: 600, borderRadius: '4px 0 0 4px',
                  color: 'var(--dm-success)',
                  border: '1px solid var(--dm-success)',
                  borderRight: 'none',
                }}
              >{`${unpushed} commit${unpushed > 1 ? 's' : ''}`} {showPushDetails ? '\u25B4' : '\u25BE'}</button>
              <button
                onClick={handlePush}
                disabled={pushing}
                className="btn-ghost"
                style={{
                  fontSize: '12px', padding: '3px 10px',
                  fontWeight: 600, borderRadius: '0 4px 4px 0',
                  color: '#fff',
                  background: 'var(--dm-success)',
                  border: '1px solid var(--dm-success)',
                  opacity: pushing ? 0.5 : 1,
                }}
              >{pushing ? 'Pushing...' : 'Push'}</button>
            </div>
            {showPushDetails && commits.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '6px',
                background: 'var(--dm-surface)', border: '1px solid var(--dm-border)',
                borderRadius: 'var(--dm-radius)', boxShadow: 'var(--dm-shadow-md)',
                padding: '8px 0', minWidth: '320px', maxWidth: '450px', zIndex: 100,
                maxHeight: '300px', overflowY: 'auto',
              }}>
                <div style={{ padding: '4px 12px 8px', fontSize: '11px', color: 'var(--dm-text-muted)', fontWeight: 600 }}>
                  Unpushed commits
                </div>
                {commits.map(c => (
                  <div key={c.hash} style={{
                    padding: '4px 12px', fontSize: '12px',
                    display: 'flex', gap: '8px', alignItems: 'baseline',
                  }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: '10px',
                      color: 'var(--dm-amber)', flexShrink: 0,
                    }}>{c.hash}</span>
                    <span style={{ color: 'var(--dm-text)', lineHeight: 1.4 }}>{c.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {pushResult && (
          <span style={{ fontSize: '11px', fontWeight: 500, color: pushResult === 'Pushed!' ? 'var(--dm-success)' : 'var(--dm-danger)' }}>
            {pushResult}
          </span>
        )}
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
