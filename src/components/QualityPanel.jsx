import React, { useRef, useEffect, useMemo, useState } from 'react';

const DIM_KEYS = [
  'typeSafety', 'componentArchitecture', 'errorHandling', 'testing',
  'cssDesignSystem', 'i18nCompleteness', 'accessibility', 'security',
  'performance', 'devopsBuildHealth'
];

const DIM_LABELS = {
  typeSafety: 'Type Safety',
  componentArchitecture: 'Architecture',
  errorHandling: 'Error Handling',
  testing: 'Testing',
  cssDesignSystem: 'CSS / Design',
  i18nCompleteness: 'i18n',
  accessibility: 'Accessibility',
  security: 'Security',
  performance: 'Performance',
  devopsBuildHealth: 'DevOps'
};

const DIM_SHORT = {
  typeSafety: 'Types',
  componentArchitecture: 'Arch',
  errorHandling: 'Errors',
  testing: 'Tests',
  cssDesignSystem: 'CSS',
  i18nCompleteness: 'i18n',
  accessibility: 'a11y',
  security: 'Security',
  performance: 'Perf',
  devopsBuildHealth: 'DevOps'
};

const DIM_DESCRIPTIONS = {
  typeSafety: 'Strict TypeScript usage — no `any` types, typed Supabase rows, proper error narrowing with `unknown`. Measures how much the compiler can catch before runtime.',
  componentArchitecture: 'Component size and separation of concerns — files under 400 LOC, single responsibility, extracted subcomponents with typed props. God components score low.',
  errorHandling: 'User-facing feedback for all mutations — no silent catch blocks, toast notifications on success/failure, disabled buttons during pending, ErrorBoundary coverage.',
  testing: 'Test coverage breadth — unit tests for utils/hooks, render smoke tests for every page, error path coverage, shared test helpers. Measured by test count and scope.',
  cssDesignSystem: 'Design system discipline — CSS variables over hardcoded hex, minimal inline styles, no unused selectors, consistent token usage across all components.',
  i18nCompleteness: 'Translation coverage — all UI strings in i18n system with both languages, no hardcoded Cyrillic/English in components, consistent key naming.',
  accessibility: 'WCAG 2.1 AA compliance — semantic HTML, keyboard navigation, ARIA labels, focus traps in modals, translated screen reader text, no div-onClick without keyboard handler.',
  security: 'Row Level Security on all tables, no hardcoded secrets, XSS-safe rendering, auth token handling, file upload validation, dependency audit.',
  performance: 'Bundle size, memoization of expensive computations, code splitting, lazy loading of dev-only code, no unnecessary re-renders in heavy components.',
  devopsBuildHealth: 'Build reliability — zero type errors, zero lint errors, CI/CD pipeline, automated tests, preview deploys. Measures infrastructure confidence.',
};

function scoreColor(s) {
  if (s >= 8) return 'var(--dm-success)';
  if (s >= 6) return 'var(--dm-accent)';
  if (s >= 4) return 'var(--dm-amber)';
  return 'var(--dm-danger)';
}

function gradeClass(g) {
  if (g.startsWith('A')) return 'var(--dm-success)';
  if (g.startsWith('B')) return 'var(--dm-accent)';
  if (g.startsWith('C')) return 'var(--dm-amber)';
  return 'var(--dm-danger)';
}

function trendFromScores(current, previous) {
  if (previous == null) return 'baseline';
  const diff = current - previous;
  if (diff >= 1) return 'up';
  if (diff <= -1) return 'down';
  return 'stable';
}

function Tooltip({ text, children, style: wrapStyle }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  const handleEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
    setShow(true);
  };

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setShow(false)}
        style={{ cursor: 'help', borderBottom: '1px dashed var(--dm-border)', ...wrapStyle }}
      >
        {children}
      </span>
      {show && (
        <div style={{
          position: 'fixed', left: pos.x, top: pos.y,
          transform: 'translateX(-50%)',
          zIndex: 1000,
          maxWidth: 300, padding: '8px 12px',
          background: 'var(--dm-text)', color: 'var(--dm-bg)',
          borderRadius: 'var(--dm-radius-sm)',
          fontSize: 12, lineHeight: 1.5,
          boxShadow: 'var(--dm-shadow-lg)',
          pointerEvents: 'none',
        }}>
          {text}
        </div>
      )}
    </>
  );
}

function TrendArrow({ trend }) {
  if (trend === 'up') return <span style={{ color: 'var(--dm-success)', fontSize: 14 }}>&#9650;</span>;
  if (trend === 'down') return <span style={{ color: 'var(--dm-danger)', fontSize: 14 }}>&#9660;</span>;
  return <span style={{ color: 'var(--dm-text-light)', fontSize: 14 }}>&#8212;</span>;
}

// ── Radar Chart ──
function RadarChart({ latest, prev, width = 380, height = 380 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !latest) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const cx = width / 2 + 10, cy = height / 2;
    const R = Math.min(width / 2, height / 2) - 62;
    const n = DIM_KEYS.length;
    const step = (2 * Math.PI) / n;
    const start = -Math.PI / 2;

    const cs = getComputedStyle(document.documentElement);
    const borderColor = cs.getPropertyValue('--dm-border').trim() || '#e0dbd5';
    const textColor = cs.getPropertyValue('--dm-text').trim() || '#3d3a37';
    const mutedColor = cs.getPropertyValue('--dm-text-muted').trim() || '#635e5a';
    const accentColor = cs.getPropertyValue('--dm-accent').trim() || '#6a8dbe';

    ctx.clearRect(0, 0, width, height);

    // Grid rings
    for (let ring = 2; ring <= 10; ring += 2) {
      const r = (ring / 10) * R;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = start + i * step;
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      if (ring === 10 || ring === 6) {
        ctx.fillStyle = mutedColor;
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ring, cx + 1, cy - r - 3);
      }
    }

    // Axis lines + labels
    for (let i = 0; i < n; i++) {
      const a = start + i * step;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 0.4;
      ctx.stroke();

      const lr = R + 38;
      const lx = cx + lr * Math.cos(a), ly = cy + lr * Math.sin(a);
      const cosA = Math.cos(a);
      ctx.fillStyle = textColor;
      ctx.font = '11px sans-serif';
      ctx.textAlign = Math.abs(cosA) < 0.15 ? 'center' : cosA > 0 ? 'left' : 'right';
      ctx.textBaseline = Math.abs(Math.sin(a)) < 0.15 ? 'middle' : Math.sin(a) > 0 ? 'top' : 'bottom';
      ctx.fillText(DIM_SHORT[DIM_KEYS[i]], lx, ly);
    }

    // Previous overlay
    if (prev) {
      drawPoly(ctx, cx, cy, R, n, start, step,
        DIM_KEYS.map(k => typeof prev.dimensions[k] === 'number' ? prev.dimensions[k] : 0),
        'rgba(106,141,190,0.1)', borderColor, 1);
    }

    // Current
    const scores = DIM_KEYS.map(k => latest.dimensions[k]?.score ?? 0);
    drawPoly(ctx, cx, cy, R, n, start, step, scores, 'rgba(106,141,190,0.2)', accentColor, 2);

    // Dots
    for (let i = 0; i < n; i++) {
      const a = start + i * step;
      const r = (scores[i] / 10) * R;
      ctx.beginPath();
      ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = accentColor;
      ctx.fill();
    }
  }, [latest, prev, width, height]);

  return <canvas ref={canvasRef} style={{ maxWidth: '100%' }} />;
}

function drawPoly(ctx, cx, cy, R, n, start, step, scores, fill, stroke, lineWidth) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const idx = i % n;
    const a = start + idx * step;
    const r = (scores[idx] / 10) * R;
    i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
            : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

// ── Timeline Chart ──
function TimelineChart({ history, width = 360, height = 200 }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null); // { idx, x, y }

  const pad = useMemo(() => ({ t: 16, r: 16, b: 40, l: 32 }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !history?.length) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const cs = getComputedStyle(document.documentElement);
    const borderColor = cs.getPropertyValue('--dm-border').trim() || '#e0dbd5';
    const mutedColor = cs.getPropertyValue('--dm-text-muted').trim() || '#635e5a';
    const textColor = cs.getPropertyValue('--dm-text').trim() || '#3d3a37';
    const accentColor = cs.getPropertyValue('--dm-accent').trim() || '#6a8dbe';
    const surfaceColor = cs.getPropertyValue('--dm-surface').trim() || '#fefcf9';

    const plotW = width - pad.l - pad.r;
    const plotH = height - pad.t - pad.b;

    ctx.clearRect(0, 0, width, height);

    // Y grid
    for (let y = 0; y <= 10; y += 2) {
      const py = pad.t + plotH - (y / 10) * plotH;
      ctx.beginPath();
      ctx.moveTo(pad.l, py);
      ctx.lineTo(width - pad.r, py);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.fillStyle = mutedColor;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(y, pad.l - 6, py);
    }

    const n = history.length;
    if (n === 1) {
      const px = pad.l + plotW / 2;
      const py = pad.t + plotH - (history[0].overallScore / 10) * plotH;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, 2 * Math.PI);
      ctx.fillStyle = accentColor;
      ctx.fill();
      ctx.fillStyle = textColor;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(history[0].overallScore.toFixed(1), px, py - 10);
      ctx.fillStyle = mutedColor;
      ctx.font = '9px monospace';
      ctx.fillText(history[0].commitRef, px, height - pad.b + 14);
      return;
    }

    const stepX = plotW / (n - 1);

    // Hover highlight
    if (hover !== null) {
      const hx = pad.l + hover.idx * stepX;
      ctx.beginPath();
      ctx.moveTo(hx, pad.t);
      ctx.lineTo(hx, pad.t + plotH);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Line + area
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const px = pad.l + i * stepX;
      const py = pad.t + plotH - (history[i].overallScore / 10) * plotH;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineTo(pad.l + (n - 1) * stepX, pad.t + plotH);
    ctx.lineTo(pad.l, pad.t + plotH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(106,141,190,0.1)';
    ctx.fill();

    // Points
    for (let i = 0; i < n; i++) {
      const px = pad.l + i * stepX;
      const py = pad.t + plotH - (history[i].overallScore / 10) * plotH;
      const isHovered = hover !== null && hover.idx === i;
      ctx.beginPath();
      ctx.arc(px, py, isHovered ? 5 : 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = accentColor;
      ctx.fill();
      ctx.strokeStyle = surfaceColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(history[i].overallScore.toFixed(1), px, py - 9);
      // X label
      ctx.fillStyle = mutedColor;
      ctx.font = '9px monospace';
      ctx.fillText(history[i].commitRef, px, height - pad.b + 14);
    }
  }, [history, width, height, hover, pad]);

  const handleMouseMove = (e) => {
    if (!history || history.length < 2) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const plotW = width - pad.l - pad.r;
    const n = history.length;
    const stepX = plotW / (n - 1);
    // find nearest point
    let closest = -1;
    let closestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const px = pad.l + i * stepX;
      const d = Math.abs(mx - px);
      if (d < closestDist) { closestDist = d; closest = i; }
    }
    if (closestDist < stepX * 0.6 && closest > 0) {
      const px = pad.l + closest * stepX;
      const plotH = height - pad.t - pad.b;
      const py = pad.t + plotH - (history[closest].overallScore / 10) * plotH;
      setHover({ idx: closest, x: px, y: py });
    } else {
      setHover(null);
    }
  };

  // Build tooltip content for hovered point
  const tooltipContent = useMemo(() => {
    if (!hover || !history || hover.idx < 1) return null;
    const cur = history[hover.idx];
    const prv = history[hover.idx - 1];
    if (!cur?.dimensions || !prv?.dimensions) return null;

    const diffs = DIM_KEYS.map(key => {
      const curVal = cur.dimensions[key]?.score ?? (typeof cur.dimensions[key] === 'number' ? cur.dimensions[key] : null);
      const prvVal = prv.dimensions[key]?.score ?? (typeof prv.dimensions[key] === 'number' ? prv.dimensions[key] : null);
      if (curVal == null || prvVal == null) return null;
      const delta = curVal - prvVal;
      if (delta === 0) return null;
      return { key, delta };
    }).filter(Boolean);

    diffs.sort((a, b) => b.delta - a.delta); // improvements first, then regressions

    const overall = (cur.overallScore - prv.overallScore).toFixed(1);
    return { diffs, overall, commitRef: cur.commitRef, date: cur.date };
  }, [hover, history]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(null)}
    >
      <canvas ref={canvasRef} style={{ maxWidth: '100%', cursor: hover ? 'pointer' : 'default' }} />
      {hover && tooltipContent && (
        <div style={{
          position: 'absolute',
          left: hover.x,
          top: hover.y - 8,
          transform: 'translate(-50%, -100%)',
          zIndex: 1000,
          minWidth: 160,
          padding: '6px 0',
          background: 'var(--dm-text)', color: 'var(--dm-bg)',
          borderRadius: 'var(--dm-radius-sm)',
          fontSize: 11, lineHeight: 1,
          boxShadow: 'var(--dm-shadow-lg)',
          pointerEvents: 'none',
        }}>
          <div style={{ padding: '0 8px 5px', borderBottom: '1px solid rgba(255,255,255,0.15)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ opacity: 0.6 }}>{tooltipContent.commitRef}</span>
            <span style={{ fontWeight: 600, color: +tooltipContent.overall > 0 ? '#6fcf97' : +tooltipContent.overall < 0 ? '#eb5757' : 'inherit' }}>
              {+tooltipContent.overall > 0 ? '+' : ''}{tooltipContent.overall}
            </span>
          </div>
          {tooltipContent.diffs.length > 0 ? tooltipContent.diffs.map(({ key, delta }) => (
            <div key={key} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '2px 8px', gap: 10,
            }}>
              <span>{DIM_SHORT[key]}</span>
              <span style={{
                fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                color: delta > 0 ? '#6fcf97' : '#eb5757',
              }}>
                {delta > 0 ? '+' : ''}{delta}
              </span>
            </div>
          )) : (
            <div style={{ padding: '2px 8px', opacity: 0.5 }}>No changes</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sparkline ──
function Sparkline({ dimKey, history, width = 64, height = 20 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !history || history.length < 2) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const values = history.map(h =>
      typeof h.dimensions[dimKey] === 'number' ? h.dimensions[dimKey] : h.dimensions[dimKey]?.score || 0
    );
    const n = values.length;
    const pad = 2;
    const stepX = (width - pad * 2) / (n - 1);

    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = pad + i * stepX;
      const y = height - pad - (values[i] / 10) * (height - pad * 2);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }

    const cs = getComputedStyle(document.documentElement);
    const last = values[n - 1];
    let color;
    if (last >= 8) color = cs.getPropertyValue('--dm-success').trim();
    else if (last >= 6) color = cs.getPropertyValue('--dm-accent').trim();
    else if (last >= 4) color = cs.getPropertyValue('--dm-amber').trim();
    else color = cs.getPropertyValue('--dm-danger').trim();

    ctx.strokeStyle = color || '#6a8dbe';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // End dot
    const lastX = pad + (n - 1) * stepX;
    const lastY = height - pad - (last / 10) * (height - pad * 2);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2, 0, 2 * Math.PI);
    ctx.fillStyle = color || '#6a8dbe';
    ctx.fill();
  }, [dimKey, history, width, height]);

  if (!history || history.length < 2) return <span style={{ width, display: 'inline-block' }} />;
  return <canvas ref={canvasRef} />;
}

// ── Pill Badge ──
function Pill({ ok, warn, children }) {
  const bg = ok ? 'var(--dm-success-light)' : warn ? 'var(--dm-amber-light)' : 'rgba(196,122,122,0.12)';
  const dot = ok ? 'var(--dm-success)' : warn ? 'var(--dm-amber)' : 'var(--dm-danger)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 500,
      background: bg,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      {children}
    </span>
  );
}

// ── Launch helpers ──
function launchClaude(projectPath, command, title) {
  if (!projectPath) return;
  const path = projectPath.replace(/\\/g, '/');
  const url = 'claudecode:' + path + '?' + command + '?' + title;
  window.open(url, '_blank');
}

function HealthcheckButton({ projectPath }) {
  const [launched, setLaunched] = useState(false);

  const handleRun = () => {
    launchClaude(projectPath, '/codehealth scan', 'Healthcheck');
    setLaunched(true);
    setTimeout(() => setLaunched(false), 5000);
  };

  if (!projectPath) return null;

  return (
    <button
      onClick={handleRun}
      style={{
        background: launched ? 'var(--dm-success-light)' : 'transparent',
        color: launched ? 'var(--dm-success)' : 'var(--dm-accent)',
        border: launched ? 'none' : '1.5px solid var(--dm-accent)',
        borderRadius: 'var(--dm-radius-sm)',
        padding: '6px 14px', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 0.2s',
      }}
    >
      {launched ? '✓ Scanning...' : 'Healthcheck'}
    </button>
  );
}

function AutofixButton({ projectPath }) {
  const [launched, setLaunched] = useState(false);

  const handleRun = () => {
    launchClaude(projectPath, '/autofix', 'Autofix');
    setLaunched(true);
    setTimeout(() => setLaunched(false), 5000);
  };

  if (!projectPath) return null;

  return (
    <button
      onClick={handleRun}
      style={{
        background: launched ? 'var(--dm-success-light)' : 'var(--dm-accent)',
        color: launched ? 'var(--dm-success)' : '#fff',
        border: 'none', borderRadius: 'var(--dm-radius-sm)',
        padding: '6px 14px', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 0.2s',
      }}
    >
      {launched ? '✓ Fixing...' : 'Autofix'}
    </button>
  );
}

// ── Main Panel ──
export function QualityPanel({ latest, history, loading, projectPath }) {
  const prev = useMemo(() => history.length > 1 ? history[history.length - 2] : null, [history]);

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--dm-text-muted)', fontSize: 13 }}>Loading quality data...</div>;
  }

  if (!latest) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>&#9776;</div>
        <div style={{ color: 'var(--dm-text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
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
            <span style={{ fontSize: 14, color: 'var(--dm-text-muted)', fontWeight: 400 }}>/10</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--dm-text-muted)' }}>
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
        <Pill ok={b.lintErrors === 0} warn={b.lintErrors > 0 && b.lintErrors < 10}>Lint: {b.lintErrors ?? '?'} errors</Pill>
        <Pill ok={b.testsPassing}>{b.testCount ?? '?'} tests</Pill>
        <Pill ok>{b.bundleGzipKB ?? '?'}KB gzip</Pill>
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{
          background: 'var(--dm-bg)', borderRadius: 'var(--dm-radius-sm)', padding: 12,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--dm-text-muted)', marginBottom: 8 }}>Radar</div>
          <RadarChart latest={latest} prev={prev} width={360} height={340} />
        </div>
        <div style={{
          background: 'var(--dm-bg)', borderRadius: 'var(--dm-radius-sm)', padding: 12,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--dm-text-muted)', marginBottom: 8 }}>Score History</div>
          <TimelineChart history={history} width={280} height={200} />
        </div>
      </div>

      {/* ── Scorecard table ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
        <thead>
          <tr>
            {['Dimension', 'Score', '', 'Weight', 'Issues', ''].map((h, i) => (
              <th key={i} style={{
                textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em',
                color: 'var(--dm-text-light)', padding: '6px 8px', borderBottom: '2px solid var(--dm-border)',
              }}>{h}</th>
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
              <tr key={key} style={{ borderBottom: '1px solid var(--dm-border)' }}>
                <td style={{ padding: '7px 8px', fontWeight: 500 }}>
                  <Tooltip text={DIM_DESCRIPTIONS[key]}>{DIM_LABELS[key]}</Tooltip>
                </td>
                <td style={{ padding: '7px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, width: 18, textAlign: 'right' }}>{d.score}</span>
                    <div style={{ width: 60, height: 5, background: 'var(--dm-border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${d.score * 10}%`, height: '100%', borderRadius: 3, background: scoreColor(d.score) }} />
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
                  <span style={{
                    fontSize: 9, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600,
                    padding: '1px 5px', borderRadius: 3,
                    background: d.weight === 'high' ? 'rgba(196,122,122,0.12)' : d.weight === 'medium' ? 'var(--dm-amber-bg-subtle)' : 'var(--dm-accent-bg-subtle)',
                    color: d.weight === 'high' ? 'var(--dm-danger)' : d.weight === 'medium' ? 'var(--dm-amber)' : 'var(--dm-accent)',
                  }}>{d.weight}</span>
                </td>
                <td style={{ padding: '7px 8px', color: 'var(--dm-text-muted)', fontSize: 12 }}>
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

      {/* ── Findings ── */}
      {latest.topFindings?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--dm-text-muted)', marginBottom: 8 }}>Top Findings</div>
          {latest.topFindings.map((f, i) => {
            const bg = f.severity === 'high' ? 'rgba(196,122,122,0.1)' : f.severity === 'medium' ? 'var(--dm-amber-bg-subtle)' : 'var(--dm-accent-bg-subtle)';
            const dot = f.severity === 'high' ? 'var(--dm-danger)' : f.severity === 'medium' ? 'var(--dm-amber)' : 'var(--dm-accent)';
            return (
              <div key={i} style={{
                display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 'var(--dm-radius-sm)',
                background: bg, marginBottom: 4, alignItems: 'flex-start', fontSize: 12,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, marginTop: 4, flexShrink: 0 }} />
                <div>
                  <div>{f.finding}</div>
                  <div style={{ fontSize: 10, color: 'var(--dm-text-muted)', marginTop: 1 }}>{DIM_LABELS[f.dimension] || f.dimension}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
