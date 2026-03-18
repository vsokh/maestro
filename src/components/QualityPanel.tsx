import React, { useMemo } from 'react';
import type { QualityReport, QualityHistoryEntry } from '../types';
import { gradeClass } from './quality/shared';
import { Pill } from './quality/Tooltip';
import { HealthcheckButton, AutofixButton } from './quality/LaunchButtons';
import { RadarChart } from './quality/RadarChart';
import { TimelineChart } from './quality/TimelineChart';
import { Scorecard } from './quality/Scorecard';
import { FindingsPanel } from './quality/FindingsPanel';

interface QualityPanelProps {
  latest: QualityReport | null;
  history: QualityHistoryEntry[];
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
  projectPath: string;
}

export function QualityPanel({ latest, history, loading, error, onRetry, projectPath }: QualityPanelProps) {
  const prev = useMemo(() => history.length > 1 ? history[history.length - 2] : null, [history]);

  if (loading) {
    return <div className="text-muted" style={{ padding: 24, fontSize: 13 }}>Loading quality data...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>&#9888;</div>
        <div className="text-muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
          Quality data unavailable
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn btn-secondary"
            style={{ fontSize: 12 }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!latest) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>&#9776;</div>
        <div className="text-muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
          No quality data yet.
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <HealthcheckButton projectPath={projectPath} />
          <AutofixButton projectPath={projectPath} />
        </div>
      </div>
    );
  }

  const b = latest.baseline || {};
  const scoreDelta = prev ? (latest.overallScore - prev.overallScore).toFixed(1) : null;

  return (
    <div style={{ padding: '0 16px 16px' }}>

      {/* ── Header row: grade + score + baseline pills ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 700,
          background: 'var(--dm-accent-bg-subtle)', color: gradeClass(latest.grade),
          flexShrink: 0,
        }}>
          {latest.grade}
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
            {latest.overallScore.toFixed(1)}
            <span className="text-muted" style={{ fontSize: 14, fontWeight: 400 }}>/10</span>
          </div>
          <div className="text-muted" style={{ fontSize: 11 }}>
            {scoreDelta !== null ? (
              <span style={{ color: +scoreDelta > 0 ? 'var(--dm-success)' : +scoreDelta < 0 ? 'var(--dm-danger)' : 'var(--dm-text-muted)' }}>
                {+scoreDelta > 0 ? '+' : ''}{scoreDelta}
              </span>
            ) : 'baseline'}
            {prev ? ` vs ${prev.date}` : ''}
            {' \u00b7 '}
            <code style={{ fontSize: 10 }}>{latest.commitRef}</code>
            {' \u00b7 '}
            {latest.date}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <HealthcheckButton projectPath={projectPath} />
          <AutofixButton projectPath={projectPath} />
        </div>
      </div>

      {/* Baseline pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <Pill ok={b.buildPasses}>{b.buildPasses ? 'Build passing' : 'Build FAILING'}</Pill>
        <Pill ok={(b.lintErrors ?? 0) === 0} warn={(b.lintErrors ?? 0) > 0 && (b.lintErrors ?? 0) < 10}>Lint: {b.lintErrors ?? '?'} errors</Pill>
        <Pill ok={b.testsPassing}>{b.testCount ?? '?'} tests</Pill>
        <Pill ok>{b.bundleGzipKB ?? '?'}KB gzip</Pill>
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{
          background: 'var(--dm-bg)', borderRadius: 'var(--dm-radius-sm)', padding: 12,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div className="label-sm" style={{ marginBottom: 8 }}>Radar</div>
          <RadarChart latest={latest} prev={prev} width={360} height={340} />
        </div>
        <div style={{
          background: 'var(--dm-bg)', borderRadius: 'var(--dm-radius-sm)', padding: 12,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div className="label-sm" style={{ marginBottom: 8 }}>Score History</div>
          <TimelineChart history={history} width={280} height={200} />
        </div>
      </div>

      {/* ── Scorecard table ── */}
      <Scorecard latest={latest} prev={prev} history={history} />

      {/* ── Findings ── */}
      <FindingsPanel findings={latest.topFindings ?? []} />
    </div>
  );
}
