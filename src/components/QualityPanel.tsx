import React, { useMemo } from 'react';
import type { QualityReport, QualityHistoryEntry } from '../types';
import { gradeClass } from './quality/shared';
import { Pill } from './quality/Tooltip';
import { HealthcheckButton, AutofixButton } from './quality/LaunchButtons';
import { RadarChart } from './quality/RadarChart';
import { TimelineChart } from './quality/TimelineChart';
import { Scorecard } from './quality/Scorecard';
import { FindingsPanel } from './quality/FindingsPanel';
import {
  QUALITY_LOADING, QUALITY_UNAVAILABLE, QUALITY_RETRY, QUALITY_NO_DATA,
  QUALITY_RADAR, QUALITY_HISTORY, QUALITY_BASELINE,
} from '../constants/strings.ts';

interface QualityPanelProps {
  latest: QualityReport | null;
  history: QualityHistoryEntry[];
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
}

export function QualityPanel({ latest, history, loading, error, onRetry }: QualityPanelProps) {
  const prev = useMemo(() => history.length > 1 ? history[history.length - 2] : null, [history]);

  if (loading) {
    return <div className="text-muted" style={{ padding: 24, fontSize: 13 }}>{QUALITY_LOADING}</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>&#9888;</div>
        <div className="text-muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
          {QUALITY_UNAVAILABLE}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn btn-secondary"
            style={{ fontSize: 12 }}
          >
            {QUALITY_RETRY}
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
          {QUALITY_NO_DATA}
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <HealthcheckButton />
          <AutofixButton />
        </div>
      </div>
    );
  }

  const b = latest.baseline || {};
  const scoreDelta = prev ? (latest.overallScore - prev.overallScore).toFixed(1) : null;

  return (
    <div style={{ padding: '0 16px 16px' }}>

      {/* -- Header row: grade + score + baseline pills -- */}
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
            ) : QUALITY_BASELINE}
            {prev ? ` vs ${prev.date}` : ''}
            {' \u00b7 '}
            <code style={{ fontSize: 10 }}>{latest.commitRef}</code>
            {' \u00b7 '}
            {latest.date}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <HealthcheckButton />
          <AutofixButton />
        </div>
      </div>

      {/* Baseline pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <Pill ok={b.buildPasses}>{b.buildPasses ? 'Build passing' : 'Build FAILING'}</Pill>
        <Pill ok={(b.lintErrors ?? 0) === 0} warn={(b.lintErrors ?? 0) > 0 && (b.lintErrors ?? 0) < 10}>Lint: {b.lintErrors ?? '?'} errors</Pill>
        <Pill ok={b.testsPassing}>{b.testCount ?? '?'} tests</Pill>
        {b.testCoveragePercent != null && (
          <Pill
            ok={b.testCoveragePercent >= 80}
            warn={b.testCoveragePercent >= 50 && b.testCoveragePercent < 80}
          >
            {b.testCoveragePercent}% coverage
          </Pill>
        )}
        <Pill ok>{b.bundleGzipKB ?? '?'}KB gzip</Pill>
        {b.depVulnerabilities && (
          <Pill
            ok={(b.depVulnerabilities.total ?? 0) === 0}
            warn={(b.depVulnerabilities.total ?? 0) > 0 && (b.depVulnerabilities.critical ?? 0) === 0 && (b.depVulnerabilities.high ?? 0) === 0}
          >
            {b.depVulnerabilities.total ?? 0} vulns{(b.depVulnerabilities.critical ?? 0) > 0 ? ` (${b.depVulnerabilities.critical} crit)` : (b.depVulnerabilities.high ?? 0) > 0 ? ` (${b.depVulnerabilities.high} high)` : ''}
          </Pill>
        )}
        {b.sentry && (
          <Pill
            ok={(b.sentry.unresolvedCount ?? 0) < 5}
            warn={(b.sentry.unresolvedCount ?? 0) >= 5 && (b.sentry.unresolvedCount ?? 0) < 15}
          >
            Sentry: {b.sentry.unresolvedCount ?? '?'} unresolved
          </Pill>
        )}
      </div>

      {/* -- Charts row -- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{
          background: 'var(--dm-bg)', borderRadius: 'var(--dm-radius-sm)', padding: 12,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div className="label-sm" style={{ marginBottom: 8 }}>{QUALITY_RADAR}</div>
          <RadarChart latest={latest} prev={prev} width={360} height={340} />
        </div>
        <div style={{
          background: 'var(--dm-bg)', borderRadius: 'var(--dm-radius-sm)', padding: 12,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div className="label-sm" style={{ marginBottom: 8 }}>{QUALITY_HISTORY}</div>
          <TimelineChart history={history} width={280} height={200} />
        </div>
      </div>

      {/* -- Scorecard table -- */}
      <Scorecard latest={latest} prev={prev} history={history} />

      {/* -- Findings -- */}
      <FindingsPanel findings={latest.topFindings ?? []} />
    </div>
  );
}
