import React from 'react';

interface SectionHeaderProps {
  title: string;
  count?: number | null;
  extra?: React.ReactNode;
}

export function SectionHeader({ title, count, extra }: SectionHeaderProps) {
  return (
    <div className="panel-header flex-between" style={{ padding: '10px 16px' }}>
      <span className="section-label">
        {title}
      </span>
      <div className="flex-center gap-8">
        {count != null ? (
          <span className="text-light text-11">{count}</span>
        ) : null}
        {extra || null}
      </div>
    </div>
  );
}
