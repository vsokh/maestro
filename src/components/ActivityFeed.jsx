import React, { useMemo } from 'react';

function isCompleted(label) {
  return /completed|done/i.test(label);
}

export function ActivityFeed({ activity, onRemove }) {
  const entries = useMemo(() => {
    return [...activity]
      .sort((a, b) => b.time - a.time)
      .slice(0, 15)
      .map(a => {
        const d = new Date(a.time);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        return {
          key: a.id,
          label: a.label,
          completed: isCompleted(a.label),
          commitRef: a.commitRef || null,
          filesChanged: a.filesChanged || null,
          isToday,
          date: isToday
            ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        };
      });
  }, [activity]);

  if (entries.length === 0) {
    return (
      <div style={{
        padding: '20px 16px', textAlign: 'center', color: 'var(--text-light)', fontSize: '12px',
      }}>
        No activity yet
      </div>
    );
  }

  return (
    <div style={{ padding: '2px 0' }}>
      {entries.map(e => (
        <div key={e.key} className="activity-row" style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '5px 14px',
          opacity: e.isToday ? 1 : 0.6,
        }}>
          {/* Colored dot */}
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: e.completed ? 'var(--success)' : 'var(--border)',
          }} />

          {/* Label */}
          <span style={{
            flex: 1, fontSize: '12px', color: 'var(--text)',
            fontWeight: e.isToday ? 500 : 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{e.label}</span>

          {/* Metadata */}
          {e.commitRef ? (
            <span style={{
              fontFamily: 'monospace', fontSize: '10px', fontWeight: 600,
              background: 'var(--accent-light)', color: 'var(--accent)',
              padding: '0 5px', borderRadius: '3px', flexShrink: 0,
            }}>{e.commitRef}</span>
          ) : null}

          {/* Timestamp */}
          <span style={{
            fontSize: '10px', color: 'var(--text-light)',
            flexShrink: 0, minWidth: '36px', textAlign: 'right',
          }}>{e.date}</span>

          {/* Remove */}
          <button
            onClick={() => onRemove(e.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-light)', fontSize: '11px', padding: '0 2px',
              lineHeight: 1, opacity: 0, transition: 'opacity 0.15s',
            }}
            className="activity-remove"
            title="Remove"
          >×</button>
        </div>
      ))}
    </div>
  );
}
