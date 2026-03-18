import React, { useMemo } from 'react';
import { EPIC_PALETTE } from '../../constants/colors.ts';
import { hashString } from '../../utils/hash.ts';
import { EPIC_LABEL, EPIC_PLACEHOLDER } from '../../constants/strings.ts';
import type { Task, Epic, EpicColor } from '../../types';

interface EpicFieldProps {
  task: Task;
  epics: Epic[];
  onUpdateTask: (id: number, updates: Partial<Task>) => void;
}

export function EpicField({ task, epics, onUpdateTask }: EpicFieldProps) {
  const epicColorMap = useMemo(() => {
    const map: Record<string, EpicColor> = {};
    (epics || []).forEach(e => {
      const idx = (e.color != null ? e.color : hashString(e.name)) % EPIC_PALETTE.length;
      map[e.name] = EPIC_PALETTE[idx];
    });
    return map;
  }, [epics]);

  return (
    <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
        className="input-epic"
        style={{ flex: 1, padding: '3px 8px', fontSize: '12px' }}
      />
      <datalist id="epic-list">
        {(epics || []).map(e => (
          <option key={e.name} value={e.name} />
        ))}
      </datalist>
    </div>
  );
}
