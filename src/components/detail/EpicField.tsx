import React, { useMemo } from 'react';
import { EPIC_LABEL, EPIC_PLACEHOLDER } from '../../constants/strings.ts';
import { getEpicColorMap } from '../../utils/taskFilters.ts';
import type { Task, Epic, EpicColor } from '../../types';

interface EpicFieldProps {
  task: Task;
  epics: Epic[];
  onUpdateTask: (id: number, updates: Partial<Task>) => void;
}

export function EpicField({ task, epics, onUpdateTask }: EpicFieldProps) {
  const epicColorMap = useMemo(() => getEpicColorMap(epics), [epics]);

  return (
    <div className="mb-12 flex-center gap-6">
      <span className="label">{EPIC_LABEL}</span>
      {task.group && epicColorMap[task.group] ? (
        <span style={{
          width: "8px", height: "8px", borderRadius: "50%",
          background: epicColorMap[task.group].text,
          display: "inline-block",
        }} />
      ) : null}
      <input
        value={task.group || ''}
        onInput={(e: React.FormEvent<HTMLInputElement>) => onUpdateTask(task.id, { group: (e.target as HTMLInputElement).value || undefined })}
        placeholder={EPIC_PLACEHOLDER}
        list="epic-list"
        className="input-epic flex-1 text-12"
        style={{ padding: '3px 8px' }}
      />
      <datalist id="epic-list">
        {(epics || []).map(e => (
          <option key={e.name} value={e.name} />
        ))}
      </datalist>
    </div>
  );
}
