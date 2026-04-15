import { useState, useRef } from 'react';
import { api } from '../../api.ts';
import { resolveModel } from '../../constants/engines.ts';
import type { TaskOutput } from '../../hooks/useProcessOutput.ts';
import { OutputViewer } from '../queue/OutputViewer.tsx';

export const TASK_ID_ERROR_TRACKER = -3;

const LAUNCH_CMD = '/error-tracker scan';

interface ErrorTrackerButtonProps {
  processOutput?: TaskOutput;
  onClearOutput?: (taskId: number) => void;
}

export function ErrorTrackerButton({ processOutput, onClearOutput }: ErrorTrackerButtonProps) {
  const [launching, setLaunching] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const pidRef = useRef<number | null>(null);
  const launchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const running = !!processOutput?.running;
  const busy = running || (launching && !running);
  const hasOutput = (processOutput?.lines.length ?? 0) > 0 || running;

  const handleTerminal = async () => {
    if (busy) return;
    try {
      const model = resolveModel(LAUNCH_CMD);
      await api.launchTerminal(TASK_ID_ERROR_TRACKER, LAUNCH_CMD, undefined, 'Error Tracker', model);
      setFlashing(true);
      setTimeout(() => setFlashing(false), 1500);
    } catch (err) {
      console.error('Failed to open Error Tracker terminal:', err);
    }
  };

  const clearLaunchTimer = () => {
    if (launchTimerRef.current) { clearTimeout(launchTimerRef.current); launchTimerRef.current = null; }
  };

  const handleBg = async () => {
    if (busy) return;
    try {
      setLaunching(true);
      clearLaunchTimer();
      launchTimerRef.current = setTimeout(() => setLaunching(false), 10000);
      const model = resolveModel(LAUNCH_CMD);
      const res = await api.launch(TASK_ID_ERROR_TRACKER, LAUNCH_CMD, undefined, model);
      pidRef.current = res.pid;
    } catch (err) {
      console.error('Failed to launch Error Tracker:', err);
      clearLaunchTimer();
      setLaunching(false);
    }
  };

  const handleStop = async () => {
    const pid = pidRef.current || processOutput?.pid;
    if (pid) { try { await api.killProcess(pid); } catch { /* ok */ } }
    pidRef.current = null;
    clearLaunchTimer();
    setLaunching(false);
    onClearOutput?.(TASK_ID_ERROR_TRACKER);
  };

  const cls = `healthcheck-btn ${busy ? 'healthcheck-btn--launched' : 'healthcheck-btn--idle'}`;

  return (
    <div>
      <div style={{ display: 'inline-flex', borderRadius: 'var(--dm-radius-sm)', overflow: 'hidden' }}>
        <button
          onClick={busy ? handleStop : handleTerminal}
          title={busy ? 'Click to stop' : 'Open in terminal'}
          className={cls}
          style={{
            padding: '6px 12px', position: 'relative', overflow: 'hidden',
            borderRadius: 0, borderTopLeftRadius: 'var(--dm-radius-sm)', borderBottomLeftRadius: 'var(--dm-radius-sm)',
          }}
        >
          {busy && <span className="system-launch-pulse" />}
          {busy ? 'Scanning...' : flashing ? 'Opened' : 'Scan Errors'}
        </button>
        <button
          onClick={handleBg}
          disabled={busy}
          title={busy ? 'Running...' : 'Run in background'}
          className={cls}
          style={{
            padding: '6px 6px', position: 'relative', overflow: 'hidden',
            borderRadius: 0, borderTopRightRadius: 'var(--dm-radius-sm)', borderBottomRightRadius: 'var(--dm-radius-sm)',
            marginLeft: 1, fontSize: 10, lineHeight: 1,
          }}
        >
          {busy && <span className="system-launch-pulse" />}
          {'\u25BC'}
        </button>
      </div>
      {hasOutput && onClearOutput && (
        <div style={{ marginTop: 6 }}>
          <OutputViewer taskId={TASK_ID_ERROR_TRACKER} taskName="Error Tracker" output={processOutput} onClear={onClearOutput} />
        </div>
      )}
    </div>
  );
}
