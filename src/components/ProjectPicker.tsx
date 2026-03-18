import React from 'react';
import {
  PROJECT_PICKER_TITLE, PROJECT_PICKER_SUBTITLE, PROJECT_PICKER_CONNECT,
  PROJECT_PICKER_CONNECTING, PROJECT_PICKER_ERROR, PROJECT_PICKER_LAST_OPENED,
} from '../constants/strings.ts';

interface ProjectPickerProps {
  onConnect: () => void;
  onReconnect: () => void;
  lastProjectName: string;
  status: string;
}

function LoadingSkeleton() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Skeleton header */}
      <div className="skeleton-header">
        <div className="skeleton-bar" style={{ width: '140px', height: '16px' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="skeleton-bar skeleton-circle" style={{ width: '24px', height: '24px' }} />
          <div className="skeleton-bar skeleton-circle" style={{ width: '24px', height: '24px' }} />
        </div>
      </div>

      {/* Skeleton body */}
      <div style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '24px 32px' }}>
        {/* Tab bar skeleton */}
        <div className="skeleton-panel" style={{ marginBottom: '16px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div className="skeleton-bar" style={{ width: '50px', height: '14px' }} />
            <div className="skeleton-bar" style={{ width: '50px', height: '14px' }} />
          </div>
        </div>

        {/* Top grid skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px', marginBottom: '16px' }}>
          <div className="skeleton-panel" style={{ padding: '16px' }}>
            <div className="skeleton-bar" style={{ width: '80px', height: '12px', marginBottom: '16px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton-card" />
              <div className="skeleton-card" />
              <div className="skeleton-card" />
            </div>
          </div>
          <div className="skeleton-panel" style={{ padding: '16px' }}>
            <div className="skeleton-bar" style={{ width: '50px', height: '12px', marginBottom: '16px' }} />
            <div className="skeleton-bar" style={{ width: '100%', height: '12px', marginBottom: '8px' }} />
            <div className="skeleton-bar" style={{ width: '80%', height: '12px', marginBottom: '8px' }} />
            <div className="skeleton-bar" style={{ width: '60%', height: '12px' }} />
          </div>
        </div>

        {/* Bottom grid skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="skeleton-panel" style={{ padding: '16px' }}>
            <div className="skeleton-bar" style={{ width: '50px', height: '12px', marginBottom: '16px' }} />
            <div className="skeleton-bar" style={{ width: '100%', height: '14px', marginBottom: '8px' }} />
            <div className="skeleton-bar" style={{ width: '90%', height: '14px' }} />
          </div>
          <div className="skeleton-panel" style={{ padding: '16px' }}>
            <div className="skeleton-bar" style={{ width: '60px', height: '12px', marginBottom: '16px' }} />
            <div className="skeleton-bar" style={{ width: '85%', height: '12px', marginBottom: '8px' }} />
            <div className="skeleton-bar" style={{ width: '70%', height: '12px' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectPicker({ onConnect, onReconnect, lastProjectName, status }: ProjectPickerProps) {
  if (status === 'connecting') {
    return <LoadingSkeleton />;
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '32px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontWeight: 700, fontSize: '28px', color: 'var(--dm-text)', marginBottom: '8px' }}>{PROJECT_PICKER_TITLE}</h1>
        <p className="text-light" style={{ fontSize: '14px' }}>{PROJECT_PICKER_SUBTITLE}</p>
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
        {status === 'connecting' ? PROJECT_PICKER_CONNECTING : PROJECT_PICKER_CONNECT}
      </button>

      {lastProjectName ? (
        <button
          onClick={onReconnect}
          className="btn-reconnect"
          style={{ fontSize: '13px', padding: '8px 16px' }}
        >
          {PROJECT_PICKER_LAST_OPENED} {lastProjectName}
        </button>
      ) : null}

      {status === 'error' ? (
        <div className="text-danger" style={{ fontSize: '13px' }}>
          {PROJECT_PICKER_ERROR}
        </div>
      ) : null}
    </div>
  );
}
