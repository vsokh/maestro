import React, { useState } from 'react';

interface ProjectPathConfigProps {
  projectPath: string;
  onSetPath: (path: string) => void;
  showBorder: boolean;
}

export function ProjectPathConfig({ projectPath, onSetPath, showBorder }: ProjectPathConfigProps) {
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState(projectPath || '');

  const handleSavePath = () => {
    if (pathInput.trim()) {
      onSetPath(pathInput.trim());
      setEditingPath(false);
    }
  };

  if (editingPath) {
    return (
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--dm-border)', display: 'flex', gap: '6px' }}>
        <input
          type="text"
          value={pathInput}
          onInput={(e: React.FormEvent<HTMLInputElement>) => setPathInput((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSavePath()}
          placeholder="C:\Users\you\Projects\my-project"
          autoFocus
          className="mono"
          style={{
            flex: 1, padding: '6px 8px', fontSize: '12px',
            border: '1px solid var(--dm-border)', borderRadius: 'var(--dm-radius-sm)',
            background: 'var(--dm-bg)', color: 'var(--dm-text)',
          }}
        />
        <button onClick={handleSavePath} className="btn btn-primary btn-xs" style={{
          padding: '6px 10px',
        }}>Save</button>
        <button onClick={() => setEditingPath(false)} className="btn btn-secondary btn-xs" style={{
          padding: '6px 8px',
        }}>Cancel</button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '4px 12px 6px', display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '11px', borderTop: showBorder ? '1px solid var(--dm-border)' : 'none',
    }}>
      {projectPath ? (
        <>
          <span className="queue-path" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, opacity: 0.7 }}>{projectPath}</span>
          <button onClick={() => { setPathInput(projectPath); setEditingPath(true); }} className="btn-link text-light" style={{
            fontSize: '11px', flexShrink: 0,
          }}>edit</button>
        </>
      ) : (
        <button onClick={() => setEditingPath(true)} className="btn-link text-amber" style={{
          fontSize: '11px',
        }}>Set project path to enable launch</button>
      )}
    </div>
  );
}
