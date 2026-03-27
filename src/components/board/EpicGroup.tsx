import React, { useState } from 'react';
import { TaskCard } from './TaskCard.tsx';
import { EPIC_RENAME_TITLE, EPIC_DELETE_TITLE, EPIC_CONFIRM_DELETE } from '../../constants/strings.ts';
import { getGroupStats, getUnqueuedTasks } from '../../utils/taskFilters.ts';
import type { Task, QueueItem, EpicColor } from '../../types';

const handleKeyActivate = (handler: (e: React.KeyboardEvent<HTMLElement>) => void) => (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); }
};

interface EpicGroupProps {
  groupName: string | null;
  groupTasks: Task[];
  tasks: Task[];
  epicColors: Record<string, EpicColor>;
  editingGroup: string | null;
  setEditingGroup: (group: string | null) => void;
  editGroupName: string;
  setEditGroupName: (name: string) => void;
  onRenameGroup: (oldName: string, newName: string) => void;
  onDeleteGroup?: (groupName: string) => void;
  onQueueGroup: ((group: string) => void) | null;
  queue: QueueItem[];
  selectedTask: number | null;
  onSelectTask: (id: number) => void;
  onPauseTask: (id: number) => void;
  onCancelTask: (id: number) => void;
  glowTaskId: number | null;
}

export function EpicGroup({ groupName, groupTasks, tasks, epicColors, editingGroup, setEditingGroup, editGroupName, setEditGroupName, onRenameGroup, onDeleteGroup, onQueueGroup, queue, selectedTask, onSelectTask, onPauseTask, onCancelTask, glowTaskId }: EpicGroupProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div style={{ marginBottom: groupName ? '12px' : '0' }}>
      {groupName ? (
        editingGroup === groupName ? (
          <input
            value={editGroupName}
            onInput={(e: React.FormEvent<HTMLInputElement>) => setEditGroupName((e.target as HTMLInputElement).value)}
            onBlur={() => {
              const trimmed = editGroupName.trim();
              if (trimmed && trimmed !== groupName && onRenameGroup) onRenameGroup(groupName, trimmed);
              setEditingGroup(null);
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingGroup(null); }}
            autoFocus
            className="input-epic-rename mb-6"
            style={{ padding: '2px 6px' }}
          />
        ) : (
          <div className="flex-center gap-6 mb-6">
            <div
              role="button"
              tabIndex={0}
              aria-label={'Rename epic ' + groupName}
              onClick={() => { setEditingGroup(groupName); setEditGroupName(groupName); }}
              onKeyDown={handleKeyActivate(() => { setEditingGroup(groupName); setEditGroupName(groupName); })}
              title={EPIC_RENAME_TITLE}
              className="epic-label"
              style={{
                color: (epicColors[groupName] || {}).text || 'var(--dm-text-light)',
                padding: '2px 6px',
                background: (epicColors[groupName] || {}).bg || 'transparent',
              }}
            >
              {groupName}
              {(() => {
                const { total, done } = getGroupStats(tasks, groupName);
                return (
                  <span className="text-9 font-500" style={{ color: "var(--dm-text-light)", marginLeft: "6px", letterSpacing: "normal", textTransform: "none" }}>
                    {done}/{total}
                  </span>
                );
              })()}
            </div>
            {onQueueGroup && (() => {
              const unqueued = getUnqueuedTasks(groupTasks, queue || []);
              if (unqueued.length === 0) return null;
              return (
                <button
                  onClick={() => onQueueGroup(groupName)}
                  title={'Queue ' + unqueued.length + ' task(s) from ' + groupName}
                  className="btn-queue-group"
                  style={{ padding: '1px 8px' }}
                >Queue {unqueued.length}</button>
              );
            })()}
            {onDeleteGroup && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                title={EPIC_DELETE_TITLE}
                className="btn-queue-group"
                style={{ padding: '1px 8px', opacity: 0.5 }}
              >&#10005;</button>
            )}
            {onDeleteGroup && confirmDelete && (
              <>
                <button
                  onClick={() => { onDeleteGroup(groupName); setConfirmDelete(false); }}
                  className="btn-queue-group"
                  style={{ padding: '1px 8px', color: 'var(--dm-danger, #c0392b)', fontWeight: 600 }}
                >{EPIC_CONFIRM_DELETE}</button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="btn-queue-group"
                  style={{ padding: '1px 8px' }}
                >Cancel</button>
              </>
            )}
          </div>
        )
      ) : null}
      <div className="flex-wrap gap-10">
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
