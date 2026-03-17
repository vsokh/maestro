import React from 'react';
import { STATUS } from '../../constants/statuses.js';

export function StatusFilter({ pendingTasks, activeFilter, setActiveFilter, searchText, setSearchText, searchFocused, setSearchFocused }) {
  const statusFilters = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: STATUS.PENDING },
    { label: 'In Progress', value: STATUS.IN_PROGRESS },
    { label: 'Blocked', value: STATUS.BLOCKED },
    { label: 'Paused', value: STATUS.PAUSED },
  ];
  const statusCounts = {};
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
              style={{
                fontSize: '11px', padding: '3px 10px', borderRadius: '12px',
                cursor: 'pointer', fontFamily: 'var(--dm-font)', fontWeight: 500,
                transition: 'all 0.15s', border: isActive ? '1px solid var(--dm-accent)' : '1px solid var(--dm-border)',
                background: isActive ? 'var(--dm-accent)' : 'transparent',
                color: isActive ? 'white' : 'var(--dm-text-light)',
              }}
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
        onInput={e => setSearchText(e.target.value)}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
        style={{
          fontSize: '12px', padding: '4px 10px',
          border: searchFocused ? '1px solid var(--dm-accent)' : '1px solid var(--dm-border)',
          borderRadius: '12px', background: 'var(--dm-bg)', color: 'var(--dm-text)',
          outline: 'none', fontFamily: 'var(--dm-font)', width: '160px',
        }}
      />
    </div>
  );
}
