import React from 'react';

export function DoneSection({ doneTasks, backlogTasks, doneGroups, backlogGroups, showCompleted, setShowCompleted, showBacklog, setShowBacklog, epicColors, selectedTask, onSelectTask, glowTaskId }) {
  return (
    <>
      {backlogTasks.length > 0 ? (
        <div>
          <div
            onClick={() => setShowBacklog(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              padding: '8px 0', userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--dm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Backlog
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--dm-text-light)',
            }}>{backlogTasks.length}</span>
            <span style={{ fontSize: '11px', color: 'var(--dm-text-light)', transform: showBacklog ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>&#9660;</span>
          </div>
          {showBacklog ? (
            <div style={{ paddingTop: '4px' }}>
              {[...backlogGroups.entries()].map(([groupName, groupTasks]) => (
                <div key={groupName} style={{ marginBottom: '8px' }}>
                  <div style={{
                    fontSize: '10px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em',
                    color: (epicColors[groupName] || {}).text || 'var(--dm-text-light)', opacity: 0.6,
                    display: 'inline-block', padding: '1px 5px', borderRadius: '3px',
                    background: (epicColors[groupName] || {}).bg || 'transparent',
                  }}>
                    {groupName}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {groupTasks.map(t => (
                      <div key={t.id} data-task-id={t.id} onClick={() => onSelectTask(t.id)} style={{
                        border: selectedTask === t.id ? '1px solid var(--dm-text-light)' : '1px dashed var(--dm-border)',
                        borderRadius: 'var(--dm-radius-sm)', padding: '5px 10px',
                        cursor: 'pointer', transition: 'all 0.15s', opacity: 0.6,
                      }}
                      className={glowTaskId === t.id ? 'task-card-glow' : undefined}
                      >
                        <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--dm-text-light)' }}>{t.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {doneTasks.length > 0 ? (
        <div>
          <div
            onClick={() => setShowCompleted(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              padding: '8px 0', userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--dm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Done
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--dm-text-light)',
            }}>{doneTasks.length}</span>
            <span style={{ fontSize: '11px', color: 'var(--dm-text-light)', transform: showCompleted ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>&#9660;</span>
          </div>
          {showCompleted ? (
            <div style={{ paddingTop: '4px' }}>
              {[...doneGroups.entries()].map(([groupName, groupTasks]) => (
                <div key={groupName} style={{ marginBottom: '8px' }}>
                  <div style={{
                    fontSize: '10px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em',
                    color: (epicColors[groupName] || {}).text || 'var(--dm-text-light)', opacity: 0.6,
                    display: 'inline-block', padding: '1px 5px', borderRadius: '3px',
                    background: (epicColors[groupName] || {}).bg || 'transparent',
                  }}>
                    {groupName}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {groupTasks.map(t => (
                      <div key={t.id} data-task-id={t.id} onClick={() => onSelectTask(t.id)} style={{
                        border: selectedTask === t.id ? '1px solid var(--dm-text-light)' : '1px solid var(--dm-border)',
                        borderRadius: 'var(--dm-radius-sm)', padding: '5px 10px',
                        cursor: 'pointer', transition: 'all 0.15s', opacity: 0.75,
                      }}
                      className={glowTaskId === t.id ? 'task-card-glow' : undefined}
                      >
                        <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--dm-text-light)' }}>{t.name}</span>
                        {t.commitRef ? (
                          <span style={{
                            fontFamily: 'monospace', fontSize: '9px', fontWeight: 600,
                            background: 'var(--dm-accent-light)', color: 'var(--dm-accent)',
                            padding: '0 4px', borderRadius: '3px', marginLeft: '5px',
                          }}>{t.commitRef}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
