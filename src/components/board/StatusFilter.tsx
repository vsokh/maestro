import React from 'react';
import { STATUS } from '../../constants/statuses.ts';
import type { Task } from '../../types';

interface StatusFilterProps {
  pendingTasks: Task[];
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  searchText: string;
  setSearchText: (text: string) => void;
  searchFocused: boolean;
  setSearchFocused: (focused: boolean) => void;
}

export function StatusFilter({ pendingTasks, activeFilter, setActiveFilter, searchText, setSearchText, searchFocused, setSearchFocused }: StatusFilterProps) {
  const statusFilters = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: STATUS.PENDING },
    { label: 'In Progress', value: STATUS.IN_PROGRESS },
    { label: 'Blocked', value: STATUS.BLOCKED },
    { label: 'Paused', value: STATUS.PAUSED },
  ];
  const statusCounts: Record<string, number> = {};
  for (const t of pendingTasks) {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {statusFilters.filter(f => f.value === 'all' || statusCounts[f.value]).map(f => {
          const isActive = activeFilter === f.value;
          const count = f.value === 'all' ? pendingTasks.length : (statusCounts[f.value] || 0);
          return (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={`btn-filter ${isActive ? 'btn-filter--active' : 'btn-filter--inactive'}`}
              style={{ padding: '3px 10px' }}
            >
              {f.label} {count}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        placeholder="Search tasks..."
        value={searchText}
        onInput={(e: React.FormEvent<HTMLInputElement>) => setSearchText((e.target as HTMLInputElement).value)}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
        className="input-search"
        style={{ padding: '4px 10px', width: '160px' }}
      />
    </div>
  );
}
