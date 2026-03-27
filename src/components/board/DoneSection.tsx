import React from 'react';
import { SECTION_BACKLOG, SECTION_DONE } from '../../constants/strings.ts';
import type { Task, EpicColor } from '../../types';

const handleKeyActivate = (handler: (e: React.KeyboardEvent<HTMLElement>) => void) => (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); }
};

interface DoneSectionProps {
  doneTasks: Task[];
  backlogTasks: Task[];
  doneGroups: Map<string, Task[]>;
  backlogGroups: Map<string, Task[]>;
  showCompleted: boolean;
  setShowCompleted: (fn: (prev: boolean) => boolean) => void;
  showBacklog: boolean;
  setShowBacklog: (fn: (prev: boolean) => boolean) => void;
  epicColors: Record<string, EpicColor>;
  selectedTask: number | null;
  onSelectTask: (id: number) => void;
  glowTaskId: number | null;
}

export function DoneSection({ doneTasks, backlogTasks, doneGroups, backlogGroups, showCompleted, setShowCompleted, showBacklog, setShowBacklog, epicColors, selectedTask, onSelectTask, glowTaskId }: DoneSectionProps) {
  return (
    <>
      {backlogTasks.length > 0 ? (
        <div>
          <div
            role="button"
            tabIndex={0}
            aria-expanded={showBacklog}
            onClick={() => setShowBacklog(p => !p)}
            onKeyDown={handleKeyActivate(() => setShowBacklog(p => !p))}
            className="flex-center gap-8 cursor-pointer py-8"
            style={{ userSelect: 'none' }}
          >
            <span className="label">{SECTION_BACKLOG}</span>
            <span className="section-toggle-count">{backlogTasks.length}</span>
            <span className="section-toggle-arrow" style={{ transform: showBacklog ? 'rotate(180deg)' : 'none' }}>&#9660;</span>
          </div>
          {showBacklog ? (
            <div className="pt-4">
              {[...backlogGroups.entries()].map(([groupName, groupTasks]) => (
                <div key={groupName} className="mb-8">
                  <div className="epic-label-static mb-4" style={{
                    color: (epicColors[groupName] || {}).text || 'var(--dm-text-light)', opacity: 0.6,
                    padding: '1px 5px',
                    background: (epicColors[groupName] || {}).bg || 'transparent',
                  }}>
                    {groupName}
                  </div>
                  <div className="flex-wrap gap-6">
                    {groupTasks.map(t => (
                      <div key={t.id} data-task-id={t.id} role="button" tabIndex={0} aria-label={t.name} onClick={() => onSelectTask(t.id)} onKeyDown={handleKeyActivate(() => onSelectTask(t.id))}
                        className={`task-card--backlog-compact${selectedTask === t.id ? ' task-card--selected' : ''}${glowTaskId === t.id ? ' task-card-glow' : ''}`}
                        style={{ padding: '5px 10px' }}
                      >
                        <span className="text-backlog-name">{t.name}</span>
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
            role="button"
            tabIndex={0}
            aria-expanded={showCompleted}
            onClick={() => setShowCompleted(p => !p)}
            onKeyDown={handleKeyActivate(() => setShowCompleted(p => !p))}
            className="flex-center gap-8 cursor-pointer py-8"
            style={{ userSelect: 'none' }}
          >
            <span className="label">{SECTION_DONE}</span>
            <span className="section-toggle-count">{doneTasks.length}</span>
            <span className="section-toggle-arrow" style={{ transform: showCompleted ? 'rotate(180deg)' : 'none' }}>&#9660;</span>
          </div>
          {showCompleted ? (
            <div className="pt-4">
              {[...doneGroups.entries()].map(([groupName, groupTasks]) => (
                <div key={groupName} className="mb-8">
                  <div className="epic-label-static mb-4" style={{
                    color: (epicColors[groupName] || {}).text || 'var(--dm-text-light)', opacity: 0.6,
                    padding: '1px 5px',
                    background: (epicColors[groupName] || {}).bg || 'transparent',
                  }}>
                    {groupName}
                  </div>
                  <div className="flex-wrap gap-6">
                    {groupTasks.map(t => (
                      <div key={t.id} data-task-id={t.id} role="button" tabIndex={0} aria-label={t.name} onClick={() => onSelectTask(t.id)} onKeyDown={handleKeyActivate(() => onSelectTask(t.id))}
                        className={`task-card--done-compact${selectedTask === t.id ? ' task-card--selected' : ''}${glowTaskId === t.id ? ' task-card-glow' : ''}`}
                        style={{ padding: '5px 10px' }}
                      >
                        <span className="text-backlog-name">{t.name}</span>
                        {t.commitRef ? (
                          <span className="commit-ref px-4" style={{ marginLeft: '5px' }}>{t.commitRef}</span>
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
