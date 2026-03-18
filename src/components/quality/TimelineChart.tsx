import React, { useRef, useEffect, useMemo, useState } from 'react';
import { DIM_KEYS, DIM_SHORT } from './shared';

export function TimelineChart({ history, width = 360, height = 200 }: { history: any[]; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);

  const pad = useMemo(() => ({ t: 16, r: 16, b: 40, l: 32 }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !history?.length) return;
    const ctx = canvas.getContext('2d')!;
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
      ctx.fillText(String(y), pad.l - 6, py);
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
      ctx.fillText(String(history[0].overallScore.toFixed(1)), px, py - 10);
      ctx.fillStyle = mutedColor;
      ctx.font = '9px monospace';
      ctx.fillText(String(history[0].commitRef), px, height - pad.b + 14);
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

  const handleMouseMove = (e: React.MouseEvent) => {
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
    }).filter((x): x is { key: string; delta: number } => x !== null);

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
        <div className="tooltip-popup" style={{
          position: 'absolute',
          left: hover.x,
          top: hover.y - 8,
          transform: 'translate(-50%, -100%)',
          zIndex: 1000,
          minWidth: 160,
          padding: '6px 0',
          fontSize: 11, lineHeight: 1,
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
