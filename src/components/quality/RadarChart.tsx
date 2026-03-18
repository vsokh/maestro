import React, { useRef, useEffect } from 'react';
import { DIM_KEYS, DIM_SHORT } from './shared';

function drawPoly(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, n: number, start: number, step: number, scores: number[], fill: string, stroke: string, lineWidth: number) {
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

export function RadarChart({ latest, prev, width = 380, height = 380 }: { latest: any; prev: any; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !latest) return;
    const ctx = canvas.getContext('2d')!;
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
        ctx.fillText(String(ring), cx + 1, cy - r - 3);
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
