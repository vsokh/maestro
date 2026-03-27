import React from 'react';
import { STATUS } from '../../constants/statuses.ts';
import {
  FILTER_ALL, FILTER_PENDING, FILTER_IN_PROGRESS, FILTER_BLOCKED, FILTER_PAUSED,
  FILTER_SEARCH_PLACEHOLDER,
} from '../../constants/strings.ts';
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

export function StatusFilter({ pendingTasks, activeFilter, setActiveFilter, searchText, setSearchText, searchFocused: _searchFocused, setSearchFocused }: StatusFilterProps) {
  const statusFilters = [
    { label: FILTER_ALL, value: 'all' },
    { label: FILTER_PENDING, value: STATUS.PENDING },
    { label: FILTER_IN_PROGRESS, value: STATUS.IN_PROGRESS },
    { label: FILTER_BLOCKED, value: STATUS.BLOCKED },
    { label: FILTER_PAUSED, value: STATUS.PAUSED },
  ];
  const statusCounts: Record<string, number> = {};
  for (const t of pendingTasks) {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  }
  return (
    <div className="flex-between gap-8" style={{ marginBottom: '10px' }}>
      <div className="flex-wrap gap-4">
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
        placeholder={FILTER_SEARCH_PLACEHOLDER}
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
