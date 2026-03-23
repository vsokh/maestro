import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api.ts';

interface BrowseEntry {
  name: string;
  path: string;
  isProject: boolean;
}

interface FolderPickerProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function FolderPicker({ onSelect, onClose }: FolderPickerProps) {
  const [current, setCurrent] = useState('');
  const [parent, setParent] = useState<string | null>(null);
  const [dirs, setDirs] = useState<BrowseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const browse = useCallback(async (path?: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await api.browse(path);
      setCurrent(result.current);
      setParent(result.parent);
      setDirs(result.dirs);
    } catch (err: any) {
      setError(err?.message || 'Failed to browse');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { browse(); }, [browse]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--dm-surface)',
          border: '1px solid var(--dm-border)',
          borderRadius: 'var(--dm-radius)',
          boxShadow: 'var(--dm-shadow-md)',
          width: '480px', maxHeight: '70vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--dm-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--dm-text)' }}>Open project</span>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: '16px', padding: '2px 6px' }}>×</button>
        </div>

        {/* Path bar */}
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--dm-border)',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          {parent && (
            <button
              onClick={() => browse(parent)}
              className="btn-ghost"
              style={{ fontSize: '14px', padding: '2px 8px', flexShrink: 0 }}
              title="Go up"
            >↑</button>
          )}
          <span style={{
            fontSize: '11px', color: 'var(--dm-text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            direction: 'rtl', textAlign: 'left',
          }}>
            {current}
          </span>
          <button
            onClick={() => onSelect(current)}
            className="btn-ghost"
            style={{
              fontSize: '11px', padding: '2px 10px', flexShrink: 0,
              fontWeight: 600, color: 'var(--dm-accent)',
              border: '1px solid var(--dm-accent)', borderRadius: '4px',
            }}
          >Open this</button>
        </div>

        {/* Directory list */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '4px 0',
          minHeight: '200px',
        }}>
          {loading && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--dm-text-muted)', fontSize: '13px' }}>
              Loading...
            </div>
          )}
          {error && (
            <div style={{ padding: '16px', color: 'var(--dm-danger)', fontSize: '12px' }}>
              {error}
            </div>
          )}
          {!loading && !error && dirs.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--dm-text-muted)', fontSize: '13px' }}>
              No subdirectories
            </div>
          )}
          {!loading && dirs.map(d => (
            <button
              key={d.path}
              className="btn-ghost"
              style={{
                display: 'flex', width: '100%', textAlign: 'left',
                padding: '6px 16px', fontSize: '13px', borderRadius: 0,
                alignItems: 'center', gap: '8px',
              }}
              onDoubleClick={() => onSelect(d.path)}
              onClick={() => browse(d.path)}
            >
              <span style={{ fontSize: '14px', opacity: 0.6 }}>
                {d.isProject ? '📁' : '📂'}
              </span>
              <span style={{
                color: d.isProject ? 'var(--dm-accent)' : 'var(--dm-text)',
                fontWeight: d.isProject ? 600 : 400,
              }}>
                {d.name}
              </span>
              {d.isProject && (
                <>
                  <span style={{
                    fontSize: '10px', color: 'var(--dm-text-muted)',
                    background: 'var(--dm-bg)', padding: '1px 6px', borderRadius: '3px',
                    marginLeft: 'auto',
                  }}>project</span>
                  <button
                    onClick={e => { e.stopPropagation(); onSelect(d.path); }}
                    className="btn-ghost"
                    style={{
                      fontSize: '11px', padding: '1px 8px',
                      color: 'var(--dm-accent)', fontWeight: 600,
                    }}
                  >Open</button>
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
