import React, { useState, useRef } from 'react';
import { api } from '../../api.ts';
import type { TaskOutput } from '../../hooks/useProcessOutput.ts';
import { OutputViewer } from '../queue/OutputViewer.tsx';

export const TASK_ID_RELEASE_STATUS = -3;
export const TASK_ID_RELEASE_CUT = -4;
export const TASK_ID_RELEASE_RETRO = -5;

interface LaunchButtonProps {
  processOutput?: TaskOutput;
  onClearOutput?: (taskId: number) => void;
}

function ReleaseLaunchButton({
  label, activeLabel, taskId, command, terminalTitle,
  processOutput, onClearOutput,
}: {
  label: string;
  activeLabel: string;
  taskId: number;
  command: string;
  terminalTitle: string;
  processOutput?: TaskOutput;
  onClearOutput?: (taskId: number) => void;
}) {
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
      await api.launchTerminal(taskId, command, undefined, terminalTitle);
      setFlashing(true);
      setTimeout(() => setFlashing(false), 1500);
    } catch (err) {
      console.error(`Failed to open ${terminalTitle} terminal:`, err);
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
      const res = await api.launch(taskId, command);
      pidRef.current = res.pid;
    } catch (err) {
      console.error(`Failed to launch ${terminalTitle}:`, err);
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
    onClearOutput?.(taskId);
  };

  return (
    <div>
      <div style={{ display: 'inline-flex', borderRadius: 'var(--dm-radius-sm)', overflow: 'hidden' }}>
        <button
          onClick={busy ? handleStop : handleTerminal}
          title={busy ? 'Click to stop' : 'Open in terminal'}
          className={`release-btn ${busy ? 'release-btn--launched' : 'release-btn--idle'}`}
          style={{
            padding: '6px 12px', position: 'relative', overflow: 'hidden',
            borderRadius: 0, borderTopLeftRadius: 'var(--dm-radius-sm)', borderBottomLeftRadius: 'var(--dm-radius-sm)',
          }}
        >
          {busy && <span className="system-launch-pulse" />}
          {busy ? activeLabel : flashing ? 'Opened' : label}
        </button>
        <button
          onClick={handleBg}
          disabled={busy}
          title={busy ? 'Running...' : 'Run in background'}
          className={`release-btn ${busy ? 'release-btn--launched' : 'release-btn--idle'}`}
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
          <OutputViewer taskId={taskId} taskName={terminalTitle} output={processOutput} onClear={onClearOutput} />
        </div>
      )}
    </div>
  );
}

export function ReleaseStatusButton({ processOutput, onClearOutput }: LaunchButtonProps) {
  return (
    <ReleaseLaunchButton
      label="Status" activeLabel="\u2713 Checking..."
      taskId={TASK_ID_RELEASE_STATUS} command="/release status" terminalTitle="Release Status"
      processOutput={processOutput} onClearOutput={onClearOutput}
    />
  );
}

export function ReleaseCutButton({ processOutput, onClearOutput }: LaunchButtonProps) {
  return (
    <ReleaseLaunchButton
      label="Cut Release" activeLabel="\u2713 Releasing..."
      taskId={TASK_ID_RELEASE_CUT} command="/release cut" terminalTitle="Release Cut"
      processOutput={processOutput} onClearOutput={onClearOutput}
    />
  );
}

export function RetroactiveButton({ processOutput, onClearOutput }: LaunchButtonProps) {
  return (
    <ReleaseLaunchButton
      label="Retroactive" activeLabel="\u2713 Classifying..."
      taskId={TASK_ID_RELEASE_RETRO} command="/release retroactive" terminalTitle="Retroactive Release"
      processOutput={processOutput} onClearOutput={onClearOutput}
    />
  );
}
