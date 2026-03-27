import React from 'react';
import { STATUS } from '../../constants/statuses.ts';
import { DEPS_TITLE, DEPS_REMOVE_TITLE, DEPS_ADD_TITLE } from '../../constants/strings.ts';
import type { Task } from '../../types';

interface DependenciesProps {
  task: Task;
  tasks: Task[];
  onUpdateTask: (id: number, updates: Partial<Task>) => void;
}

export function Dependencies({ task, tasks, onUpdateTask }: DependenciesProps) {
  const otherTasks = (tasks || []).filter(t => t.id !== task.id && (t.status === STATUS.PENDING || t.status === STATUS.IN_PROGRESS));
  if (otherTasks.length === 0) return null;

  const deps = task.dependsOn || [];
  const selected = otherTasks.filter(t => deps.includes(t.id));
  const available = otherTasks.filter(t => !deps.includes(t.id));

  const toggleDep = (depId: number) => {
    const next = deps.includes(depId) ? deps.filter(d => d !== depId) : [...deps, depId];
    onUpdateTask(task.id, { dependsOn: next });
  };

  return (
    <div className="mb-16">
      <div className="label mb-6">
        {DEPS_TITLE} {selected.length > 0 ? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>({selected.length})</span> : null}
      </div>
      {selected.length > 0 ? (
        <div className="flex-wrap gap-4 mb-6">
          {selected.map(t => (
            <button
              key={t.id}
              onClick={() => toggleDep(t.id)}
              title={DEPS_REMOVE_TITLE}
              className="dep-btn--selected"
              style={{ padding: '3px 10px' }}
            >
              {t.name} ×
            </button>
          ))}
        </div>
      ) : null}
      {available.length > 0 ? (
        <div className="flex-wrap gap-4">
          {available.map(t => (
            <button
              key={t.id}
              onClick={() => toggleDep(t.id)}
              title={DEPS_ADD_TITLE}
              className="dep-btn--available"
              style={{ padding: '3px 10px' }}
            >
              + {t.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
