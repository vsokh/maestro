import React from 'react';
import { STATUS } from '../../constants/statuses.js';
import { TaskCard } from './TaskCard.jsx';

const handleKeyActivate = (handler) => (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); }
};

export function EpicGroup({ groupName, groupTasks, tasks, epicColors, editingGroup, setEditingGroup, editGroupName, setEditGroupName, onRenameGroup, onQueueGroup, queue, selectedTask, onSelectTask, onPauseTask, onCancelTask, glowTaskId }) {
  return (
    <div style={{ marginBottom: groupName ? '12px' : '0' }}>
      {groupName ? (
        editingGroup === groupName ? (
          <input
            value={editGroupName}
            onInput={e => setEditGroupName(e.target.value)}
            onBlur={() => {
              const trimmed = editGroupName.trim();
              if (trimmed && trimmed !== groupName && onRenameGroup) onRenameGroup(groupName, trimmed);
              setEditingGroup(null);
            }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingGroup(null); }}
            autoFocus
            style={{
              fontSize: '10px', fontWeight: 600, color: 'var(--dm-text-light)', marginBottom: '6px',
              textTransform: 'uppercase', letterSpacing: '0.04em',
              background: 'var(--dm-bg)', border: '1px solid var(--dm-accent)', borderRadius: '3px',
              padding: '2px 6px', outline: 'none', fontFamily: 'var(--dm-font)',
            }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => { setEditingGroup(groupName); setEditGroupName(groupName); }}
              onKeyDown={handleKeyActivate(() => { setEditingGroup(groupName); setEditGroupName(groupName); })}
              title="Click to rename epic"
              style={{
                fontSize: '10px', fontWeight: 600, color: (epicColors[groupName] || {}).text || 'var(--dm-text-light)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', transition: 'all 0.15s',
                background: (epicColors[groupName] || {}).bg || 'transparent',
                display: 'inline-block',
              }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.7'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}
            >
              {groupName}
              {(() => {
                const total = tasks.filter(t => t.group === groupName).length;
                const done = tasks.filter(t => t.group === groupName && t.status === STATUS.DONE).length;
                return (
                  <span style={{ fontSize: "9px", fontWeight: 500, color: "var(--dm-text-light)", marginLeft: "6px", letterSpacing: "normal", textTransform: "none" }}>
                    {done}/{total}
                  </span>
                );
              })()}
            </div>
            {onQueueGroup && (() => {
              const unqueued = groupTasks.filter(t => (t.status === STATUS.PENDING || t.status === STATUS.PAUSED) && !(queue || []).some(q => q.task === t.id));
              if (unqueued.length === 0) return null;
              return (
                <button
                  onClick={() => onQueueGroup(groupName)}
                  title={'Queue ' + unqueued.length + ' task(s) from ' + groupName}
                  style={{
                    fontSize: '9px', fontWeight: 600, padding: '1px 8px', borderRadius: '10px',
                    cursor: 'pointer', fontFamily: 'var(--dm-font)',
                    border: '1px solid var(--dm-accent)', background: 'none', color: 'var(--dm-accent)',
                    transition: 'all 0.15s', textTransform: 'none', letterSpacing: 'normal',
                  }}
                  onMouseOver={e => { e.target.style.background = 'var(--dm-accent)'; e.target.style.color = 'white'; }}
                  onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--dm-accent)'; }}
                >Queue {unqueued.length}</button>
              );
            })()}
          </div>
        )
      ) : null}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {groupTasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            tasks={tasks}
            selectedTask={selectedTask}
            onSelectTask={onSelectTask}
            onPauseTask={onPauseTask}
            onCancelTask={onCancelTask}
            glowTaskId={glowTaskId}
          />
        ))}
      </div>
    </div>
  );
}
