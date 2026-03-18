import React from 'react';
import type { QualityReport, QualityHistoryEntry } from '../../types';
import { DIM_KEYS, DIM_LABELS, DIM_DESCRIPTIONS, scoreColor, trendFromScores } from './shared';
import { Tooltip, TrendArrow } from './Tooltip';
import { Sparkline } from './Sparkline';

interface ScorecardProps {
  latest: QualityReport;
  prev: QualityHistoryEntry | null;
  history: QualityHistoryEntry[];
}

export function Scorecard({ latest, prev, history }: ScorecardProps) {
  return (
    <table className="scorecard-table" style={{ marginBottom: 16 }}>
      <thead>
        <tr>
          {['Dimension', 'Score', '', 'Weight', 'Issues', ''].map((h, i) => (
            <th key={i} className="scorecard-th" style={{ padding: '6px 8px' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {DIM_KEYS.map(key => {
          const d = latest.dimensions[key];
          if (!d) return null;
          const prevScore = prev?.dimensions?.[key];
          const prevVal = typeof prevScore === 'number' ? prevScore : prevScore?.score ?? null;
          const trend = trendFromScores(d.score, prevVal);
          return (
            <tr key={key} className="scorecard-td">
              <td style={{ padding: '7px 8px', fontWeight: 500 }}>
                <Tooltip text={DIM_DESCRIPTIONS[key]}>{DIM_LABELS[key]}</Tooltip>
              </td>
              <td style={{ padding: '7px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600, width: 18, textAlign: 'right' }}>{d.score}</span>
                  <div className="progress-bar-track" style={{ width: 60, height: 5 }}>
                    <div className="progress-bar-fill" style={{ width: `${d.score * 10}%`, height: '100%', background: scoreColor(d.score) }} />
                  </div>
                </div>
              </td>
              <td style={{ padding: '7px 4px', width: 24 }}>
                {prevVal != null && d.score !== prevVal ? (
                  <Tooltip text={`${prevVal} → ${d.score} (${d.score - prevVal > 0 ? '+' : ''}${d.score - prevVal})`} style={{ borderBottom: 'none' }}>
                    <TrendArrow trend={trend} />
                  </Tooltip>
                ) : (
                  <TrendArrow trend={trend} />
                )}
              </td>
              <td style={{ padding: '7px 8px' }}>
                <span className={`weight-badge weight-badge--${d.weight}`} style={{
                  padding: '1px 5px',
                }}>{d.weight}</span>
              </td>
              <td className="text-muted" style={{ padding: '7px 8px', fontSize: 12 }}>
                {d.issues > 0 ? `${d.issues} issues` : 'Clean'}
              </td>
              <td style={{ padding: '7px 8px' }}>
                <Sparkline dimKey={key} history={history} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
