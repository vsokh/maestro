import React from 'react';
import { STATUS } from '../../constants/statuses.ts';
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
    <div style={{ marginBottom: '16px' }}>
      <div className="label" style={{ marginBottom: '6px' }}>
        Depends on {selected.length > 0 ? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>({selected.length})</span> : null}
      </div>
      {selected.length > 0 ? (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
          {selected.map(t => (
            <button
              key={t.id}
              onClick={() => toggleDep(t.id)}
              title="Click to remove dependency"
              className="dep-btn--selected"
              style={{ padding: '3px 10px' }}
            >
              {t.name} ×
            </button>
          ))}
        </div>
      ) : null}
      {available.length > 0 ? (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {available.map(t => (
            <button
              key={t.id}
              onClick={() => toggleDep(t.id)}
              title="Click to add dependency"
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
