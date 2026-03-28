import React from 'react';
import type { QualityReport, QualityHistoryEntry } from '../../types';
import { DIM_KEYS, DIM_LABELS, DIM_DESCRIPTIONS, scoreColor, trendFromScores, getDimValue } from './shared';
import { Tooltip, TrendArrow } from './Tooltip';
import { Sparkline } from './Sparkline';
import { SCORECARD_HEADERS, SCORECARD_CLEAN } from '../../constants/strings.ts';

interface ScorecardProps {
  latest: QualityReport;
  prev: QualityHistoryEntry | null;
  history: QualityHistoryEntry[];
}

export function Scorecard({ latest, prev, history }: ScorecardProps) {
  return (
    <table className="scorecard-table mb-16">
      <thead>
        <tr>
          {SCORECARD_HEADERS.map((h, i) => (
            <th key={i} className="scorecard-th" style={{ padding: '6px 8px' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {DIM_KEYS.map(key => {
          const d = latest.dimensions[key];
          if (!d) return null;
          const prevVal = getDimValue(prev?.dimensions, key);
          const trend = trendFromScores(d.score, prevVal);
          return (
            <tr key={key} className="scorecard-td">
              <td className="font-500" style={{ padding: '7px 8px' }}>
                <Tooltip text={DIM_DESCRIPTIONS[key]}>{DIM_LABELS[key]}</Tooltip>
              </td>
              <td style={{ padding: '7px 8px' }}>
                <div className="flex-center gap-6">
                  <span className="font-600 text-right" style={{ width: 18 }}>{d.score}</span>
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
              <td className="text-muted text-12" style={{ padding: '7px 8px' }}>
                {d.issues > 0 ? `${d.issues} issues` : SCORECARD_CLEAN}
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
