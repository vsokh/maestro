import React from 'react';

interface ProjectPickerProps {
  onConnect: () => void;
  onReconnect: () => void;
  lastProjectName: string;
  status: string;
}

export function ProjectPicker({ onConnect, onReconnect, lastProjectName, status }: ProjectPickerProps) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '32px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontWeight: 700, fontSize: '28px', color: 'var(--dm-text)', marginBottom: '8px' }}>Dev Manager</h1>
        <p className="text-light" style={{ fontSize: '14px' }}>Open a project folder to get started</p>
      </div>

      <button
        onClick={onConnect}
        disabled={status === 'connecting'}
        className="btn-connect"
        style={{
          padding: '14px 36px', fontSize: '16px',
          cursor: status === 'connecting' ? 'wait' : 'pointer',
          opacity: status === 'connecting' ? 0.7 : 1,
        }}
      >
        {status === 'connecting' ? 'Connecting...' : 'Open project'}
      </button>

      {lastProjectName ? (
        <button
          onClick={onReconnect}
          className="btn-reconnect"
          style={{ fontSize: '13px', padding: '8px 16px' }}
        >
          Last opened: {lastProjectName}
        </button>
      ) : null}

      {status === 'error' ? (
        <div className="text-danger" style={{ fontSize: '13px' }}>
          Could not connect. Make sure your browser supports the File System Access API.
        </div>
      ) : null}
    </div>
  );
}
