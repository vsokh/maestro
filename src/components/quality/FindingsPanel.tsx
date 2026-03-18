import React from 'react';
import type { QualityFinding } from '../../types';
import { DIM_LABELS } from './shared';

export function FindingsPanel({ findings }: { findings: QualityFinding[] }) {
  if (!findings || findings.length === 0) return null;

  return (
    <div>
      <div className="label-sm" style={{ marginBottom: 8 }}>Top Findings</div>
      {findings.map((f, i) => {
        const dotColor = f.severity === 'high' ? 'var(--dm-danger)' : f.severity === 'medium' ? 'var(--dm-amber)' : 'var(--dm-accent)';
        return (
          <div key={i} className={`finding-card finding-card--${f.severity}`} style={{
            display: 'flex', gap: 8, padding: '8px 10px',
            marginBottom: 4, alignItems: 'flex-start', fontSize: 12,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, marginTop: 4, flexShrink: 0 }} />
            <div>
              <div>{f.finding}</div>
              <div className="text-muted" style={{ fontSize: 10, marginTop: 1 }}>{DIM_LABELS[f.dimension as string] || f.dimension}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
