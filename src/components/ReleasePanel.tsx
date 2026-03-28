import React, { useState } from 'react';
import type { ReleaseEntry, StabilityAssessment, ChangelogSection } from '../types';
import type { TaskOutput } from '../hooks/useProcessOutput.ts';
import { Pill } from './quality/Tooltip';
import { ReleaseStatusButton, ReleaseCutButton, RetroactiveButton } from './release/LaunchButtons';
import {
  RELEASE_LOADING, RELEASE_UNAVAILABLE, RELEASE_RETRY, RELEASE_NO_DATA,
  RELEASE_HISTORY_TITLE, RELEASE_STABILITY_TITLE, RELEASE_CHANGELOG_TITLE,
} from '../constants/strings.ts';

interface ReleasePanelProps {
  releases: ReleaseEntry[];
  stability: StabilityAssessment | null;
  changelog: ChangelogSection[];
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
  statusOutput?: TaskOutput;
  cutOutput?: TaskOutput;
  retroOutput?: TaskOutput;
  onClearOutput?: (taskId: number) => void;
}

function stabilityColor(level: string) {
  if (level === 'Stable') return 'var(--dm-success)';
  if (level === 'Release Candidate') return 'var(--dm-accent)';
  if (level === 'Stabilizing') return 'var(--dm-amber)';
  return 'var(--dm-danger)';
}

function scoreColor(score: number) {
  if (score >= 85) return 'var(--dm-success)';
  if (score >= 70) return 'var(--dm-accent)';
  if (score >= 50) return 'var(--dm-amber)';
  return 'var(--dm-danger)';
}

function gateIcon(result: 'pass' | 'warn' | 'fail') {
  if (result === 'pass') return '\u2705';
  if (result === 'warn') return '\u26A0\uFE0F';
  return '\u274C';
}

const TYPE_COLORS: Record<string, string> = {
  feat: 'var(--dm-success)',
  fix: 'var(--dm-danger)',
  refactor: 'var(--dm-accent)',
  test: 'var(--dm-text-muted)',
  style: '#b07cc6',
  perf: 'var(--dm-amber)',
  a11y: '#5ba3cf',
  security: '#cf5b5b',
  docs: 'var(--dm-text-muted)',
  chore: 'var(--dm-text-muted)',
};

function BreakdownBar({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const entries = Object.entries(breakdown).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="flex" style={{ height: 6, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
        {entries.map(([type, count]) => (
          <div key={type} style={{
            flex: count, background: TYPE_COLORS[type] || 'var(--dm-border)',
            minWidth: 3,
          }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-8 mt-4">
        {entries.map(([type, count]) => (
          <span key={type} className="text-10 flex-center" style={{ gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLORS[type] || 'var(--dm-border)', display: 'inline-block' }} />
            {type} {count}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChangelogVersionSection({ section, defaultOpen }: { section: ChangelogSection; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const itemCount = section.groups.reduce((a, g) => a + g.items.length, 0);

  return (
    <div style={{
      borderRadius: 'var(--dm-radius-sm)',
      background: 'var(--dm-bg)',
      marginBottom: 6,
    }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left flex-center"
        style={{
          padding: '10px 12px', border: 'none', background: 'transparent',
          color: 'inherit', cursor: 'pointer', fontFamily: 'inherit', gap: 8,
        }}
      >
        <span className="text-12" style={{ opacity: 0.5 }}>{open ? '\u25BE' : '\u25B8'}</span>
        <span className="font-600 text-13">{section.version}</span>
        {section.date && <span className="text-muted text-11">{section.date}</span>}
        <span className="text-muted text-11" style={{ marginLeft: 'auto' }}>{itemCount} changes</span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          {section.groups.map((group) => (
            <div key={group.name} style={{ marginBottom: 8 }}>
              <div className="text-11 font-600 mb-4" style={{
                color: group.name === 'Added' ? 'var(--dm-success)'
                  : group.name === 'Fixed' ? 'var(--dm-danger)'
                  : group.name === 'Security' ? '#cf5b5b'
                  : group.name === 'Accessibility' ? '#5ba3cf'
                  : 'var(--dm-text-muted)',
              }}>
                {group.name}
              </div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {group.items.map((item, i) => (
                  <li key={i} className="text-12 leading-relaxed" style={{ color: 'var(--dm-text)' }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GateRow({ name, result }: { name: string; result: 'pass' | 'warn' | 'fail' }) {
  return (
    <Pill ok={result === 'pass'} warn={result === 'warn'}>
      {gateIcon(result)} {name}
    </Pill>
  );
}

export function ReleasePanel({ releases, stability, changelog, loading, error, onRetry, statusOutput, cutOutput, retroOutput, onClearOutput }: ReleasePanelProps) {
  if (loading) {
    return <div className="text-muted p-24 text-13">{RELEASE_LOADING}</div>;
  }

  if (error) {
    return (
      <div className="text-center" style={{ padding: 40 }}>
        <div className="mb-8" style={{ fontSize: 32, opacity: 0.3 }}>&#9888;</div>
        <div className="text-muted text-13 leading-relaxed mb-16">{RELEASE_UNAVAILABLE}</div>
        {onRetry && (
          <button onClick={onRetry} className="btn btn-secondary text-12">{RELEASE_RETRY}</button>
        )}
      </div>
    );
  }

  const hasData = stability || releases.length > 0 || changelog.length > 0;

  if (!hasData) {
    return (
      <div className="text-center" style={{ padding: 40 }}>
        <div className="mb-8" style={{ fontSize: 32, opacity: 0.3 }}>&#127991;</div>
        <div className="text-muted text-13 leading-relaxed mb-16">{RELEASE_NO_DATA}</div>
        <div className="flex gap-6 justify-center">
          <ReleaseStatusButton processOutput={statusOutput} onClearOutput={onClearOutput} />
          <RetroactiveButton processOutput={retroOutput} onClearOutput={onClearOutput} />
          <ReleaseCutButton processOutput={cutOutput} onClearOutput={onClearOutput} />
        </div>
      </div>
    );
  }

  const latestRelease = releases.length > 0 ? releases[releases.length - 1] : null;

  return (
    <div style={{ padding: '0 16px 16px' }}>

      {/* Header: version + stability */}
      <div className="flex-center flex-wrap mb-12" style={{ gap: 14 }}>
        <div className="flex-center justify-center text-20 font-700 shrink-0" style={{
          height: 52, padding: '0 16px', borderRadius: 26,
          background: 'var(--dm-accent-bg-subtle)', color: 'var(--dm-accent)',
        }}>
          {latestRelease?.version || stability?.currentVersion || 'v0.0.0'}
        </div>

        {stability && (
          <div>
            <div className="font-700" style={{ fontSize: 28, lineHeight: 1 }}>
              {stability.score}
              <span className="text-muted text-14 font-400">/100</span>
            </div>
            <div className="text-11" style={{ color: stabilityColor(stability.level) }}>
              {stability.level}
              {stability.commitsSinceRelease != null && (
                <span className="text-muted"> &middot; {stability.commitsSinceRelease} commits since release</span>
              )}
              {stability.commitRef && (
                <span className="text-muted"> &middot; <code className="text-10">{stability.commitRef}</code></span>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-6" style={{ marginLeft: 'auto' }}>
          <ReleaseStatusButton processOutput={statusOutput} onClearOutput={onClearOutput} />
          <RetroactiveButton processOutput={retroOutput} onClearOutput={onClearOutput} />
          <ReleaseCutButton processOutput={cutOutput} onClearOutput={onClearOutput} />
        </div>
      </div>

      {/* Gate pills */}
      {stability?.gateResults && (
        <div className="flex flex-wrap gap-6 mb-16">
          {Object.entries(stability.gateResults).map(([name, result]) => (
            <GateRow key={name} name={name} result={result} />
          ))}
        </div>
      )}

      {/* Stability components breakdown */}
      {stability?.components && (
        <div className="mb-16">
          <div className="label-sm mb-8">{RELEASE_STABILITY_TITLE}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {([
              ['Build / Test', stability.components.buildTest, 0.30],
              ['Codehealth', stability.components.codehealth, 0.20],
              ['Fix Ratio', stability.components.fixRatio, 0.20],
              ['Backlog', stability.components.backlog, 0.15],
              ['Regressions', stability.components.regression, 0.10],
              ['Fix Decay', stability.components.fixDecay, 0.05],
            ] as [string, number, number][]).map(([label, value, weight]) => (
              <div key={label} style={{
                padding: '10px 12px', borderRadius: 'var(--dm-radius-sm)',
                background: 'var(--dm-bg)',
              }}>
                <div className="flex-center justify-between mb-4">
                  <span className="text-12 font-500">{label}</span>
                  <span className="text-10 text-muted">{Math.round(weight * 100)}%</span>
                </div>
                <div style={{
                  height: 4, borderRadius: 2, background: 'var(--dm-border)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${value}%`, borderRadius: 2,
                    background: scoreColor(value),
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <div className="text-11 font-600 mt-4" style={{ color: scoreColor(value) }}>
                  {Math.round(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Release history with breakdown bars */}
      {releases.length > 0 && (
        <div className="mb-16">
          <div className="label-sm mb-8">{RELEASE_HISTORY_TITLE}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...releases].reverse().map((rel) => (
              <div key={rel.version} style={{
                padding: '10px 12px', borderRadius: 'var(--dm-radius-sm)',
                background: 'var(--dm-bg)',
              }}>
                <div className="flex-center mb-4" style={{ gap: 10 }}>
                  <span className="font-600 text-13">{rel.version}</span>
                  {rel.description && (
                    <span className="text-12 text-muted" style={{ flex: 1 }}>{rel.description}</span>
                  )}
                  <span className="text-11 text-muted">{rel.date}</span>
                  <span className="text-11 text-muted">{rel.commitCount} commits</span>
                  {rel.stabilityScore > 0 && (
                    <span className="text-11 font-500" style={{ color: scoreColor(rel.stabilityScore) }}>
                      {rel.stabilityScore}
                    </span>
                  )}
                  <code className="text-10 text-muted">{rel.commitRef?.slice(0, 7)}</code>
                </div>
                {rel.breakdown && <BreakdownBar breakdown={rel.breakdown} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Changelog */}
      {changelog.length > 0 && (
        <div>
          <div className="label-sm mb-8">{RELEASE_CHANGELOG_TITLE}</div>
          {changelog.map((section, i) => (
            <ChangelogVersionSection key={section.version} section={section} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
