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
    } catch (err: unknown) {
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
    <header className="dm-header header flex-between" style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <div className="flex-center gap-12 relative">
        {onSwitchProject && (
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="btn-ghost text-14"
            title="Switch project"
            style={{ padding: '2px 6px', borderRadius: '4px' }}
          >{showPicker ? '×' : '⇄'}</button>
        )}
        <span className="font-700 text-18" style={{ color: 'var(--dm-text)' }}>{projectName}</span>
        <div className={`dot-sync ${status === 'error' ? 'dot-sync--error' : 'dot-sync--ok'} shrink-0`} title={status === 'error' ? HEADER_SYNC_ERROR : HEADER_CONNECTED} />
        <span className="text-light text-14">/</span>
        <span className="text-muted font-500 text-16">{APP_NAME}</span>

        {showPicker && onSwitchProject && (
          <div className="absolute mt-8" style={{
            top: '100%', left: 0,
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
                className="btn-ghost block w-full text-left text-14"
                style={{
                  padding: '8px 16px', borderRadius: 0,
                  fontWeight: p.active ? 700 : 400,
                  color: p.active ? 'var(--dm-accent)' : 'var(--dm-text)',
                }}
              >
                {p.name}
                {p.active && <span className="text-11 ml-8" style={{ opacity: 0.5 }}>current</span>}
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
                className="btn-ghost w-full text-13 font-600"
                style={{
                  padding: '6px 12px',
                  color: 'var(--dm-accent)',
                  border: '1px solid var(--dm-accent)', borderRadius: '4px',
                }}
              >Open folder...</button>
            </div>
          </div>
        )}
      </div>
      <div className="flex-center gap-12">
        {status === 'synced' ? (
          <span className="text-accent text-12 font-500">
            {HEADER_SYNCED}
          </span>
        ) : status === 'error' ? (
          <span className="text-danger text-11">{HEADER_SYNC_ERROR}</span>
        ) : null}
        {unpushed > 0 && (
          <div className="relative">
            <div className="flex-center gap-2">
              <button
                onClick={() => setShowPushDetails(!showPushDetails)}
                className="btn-ghost text-12 font-600"
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px 0 0 4px',
                  color: 'var(--dm-success)',
                  border: '1px solid var(--dm-success)',
                  borderRight: 'none',
                }}
              >{`${unpushed} commit${unpushed > 1 ? 's' : ''}`} {showPushDetails ? '\u25B4' : '\u25BE'}</button>
              <button
                onClick={handlePush}
                disabled={pushing}
                className="btn-ghost text-12 font-600"
                style={{
                  padding: '3px 10px',
                  borderRadius: '0 4px 4px 0',
                  color: '#fff',
                  background: 'var(--dm-success)',
                  border: '1px solid var(--dm-success)',
                  opacity: pushing ? 0.5 : 1,
                }}
              >{pushing ? 'Pushing...' : 'Push'}</button>
            </div>
            {showPushDetails && commits.length > 0 && (
              <div className="absolute overflow-y-auto" style={{
                top: '100%', right: 0, marginTop: '6px',
                background: 'var(--dm-surface)', border: '1px solid var(--dm-border)',
                borderRadius: 'var(--dm-radius)', boxShadow: 'var(--dm-shadow-md)',
                padding: '8px 0', minWidth: '320px', maxWidth: '450px', zIndex: 100,
                maxHeight: '300px',
              }}>
                <div className="text-11 font-600" style={{ padding: '4px 12px 8px', color: 'var(--dm-text-muted)' }}>
                  Unpushed commits
                </div>
                {commits.map(c => (
                  <div key={c.hash} className="flex gap-8 text-12" style={{
                    padding: '4px 12px', alignItems: 'baseline',
                  }}>
                    <span className="text-10 shrink-0" style={{
                      fontFamily: 'monospace',
                      color: 'var(--dm-amber)',
                    }}>{c.hash}</span>
                    <span style={{ color: 'var(--dm-text)', lineHeight: 1.4 }}>{c.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {pushResult && (
          <span className="text-11 font-500" style={{ color: pushResult === 'Pushed!' ? 'var(--dm-success)' : 'var(--dm-danger)' }}>
            {pushResult}
          </span>
        )}
        {onOpenSkills && (
          <button
            onClick={onOpenSkills}
            aria-label="Skill categories"
            title="Configure skill categories"
            className="btn-ghost text-14"
            style={{ padding: '4px 6px' }}
          >&#9881;</button>
        )}
        {onSetDefaultEngine ? (
          <div className="flex-center gap-4">
            <span
              className="text-14"
              style={{
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
              className="select-field text-11 font-600 border-none cursor-pointer"
              style={{
                padding: '2px 18px 2px 4px',
                borderRadius: '4px',
                background: 'transparent',
                color: currentEngine.color,
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
          className="btn-theme-toggle text-16 p-4"
          style={{ lineHeight: 1 }}
        >{dark ? '☀' : '☽'}</button>
      </div>
    </header>
  );
}
