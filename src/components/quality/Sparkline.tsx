import React, { useRef, useEffect } from 'react';

export function Sparkline({ dimKey, history, width = 64, height = 20 }: { dimKey: string; history: any[]; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !history || history.length < 2) return;
    const ctx = canvas.getContext('2d')!;
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
