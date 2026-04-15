import React, { useState, useRef } from 'react';
import {
  LAUNCH_HEALTHCHECK_CMD, LAUNCH_HEALTHCHECK, LAUNCH_HEALTHCHECK_ACTIVE,
  LAUNCH_AUTOFIX_CMD, LAUNCH_AUTOFIX, LAUNCH_AUTOFIX_ACTIVE,
} from '../../constants/strings.ts';
import { api } from '../../api.ts';
import { resolveModel } from '../../constants/engines.ts';
import type { TaskOutput } from '../../hooks/useProcessOutput.ts';
import { OutputViewer } from '../queue/OutputViewer.tsx';

// Unique task IDs for system operations (negative to avoid conflicts with real tasks)
const TASK_ID_CODEHEALTH = -1;
const TASK_ID_AUTOFIX = -2;

interface LaunchButtonProps {
  processOutput?: TaskOutput;
  onClearOutput?: (taskId: number) => void;
}

function DualLaunchButton({
  label, activeLabel, taskId, command, terminalTitle,
  processOutput, onClearOutput,
  btnClass, idleClass, runClass,
}: {
  label: string;
  activeLabel: string;
  taskId: number;
  command: string;
  terminalTitle: string;
  processOutput?: TaskOutput;
  onClearOutput?: (taskId: number) => void;
  btnClass: string;
  idleClass: string;
  runClass: string;
}) {
  const [launching, setLaunching] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const pidRef = useRef<number | null>(null);
  const launchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const running = !!processOutput?.running;
  const busy = running || (launching && !running);
  const hasOutput = (processOutput?.lines.length ?? 0) > 0 || running;

  const clearLaunchTimer = () => {
    if (launchTimerRef.current) { clearTimeout(launchTimerRef.current); launchTimerRef.current = null; }
  };

  const handleBg = async () => {
    if (busy) return;
    try {
      setLaunching(true);
      clearLaunchTimer();
      launchTimerRef.current = setTimeout(() => setLaunching(false), 10000);
      const model = resolveModel(command);
      const res = await api.launch(taskId, command, undefined, model);
      pidRef.current = res.pid;
    } catch (err) {
      console.error(`Failed to launch ${terminalTitle}:`, err);
      clearLaunchTimer();
      setLaunching(false);
    }
  };

  const handleTerminal = async () => {
    if (busy) return;
    try {
      const model = resolveModel(command);
      await api.launchTerminal(taskId, command, undefined, terminalTitle, model);
      setFlashing(true);
      setTimeout(() => setFlashing(false), 1500);
    } catch (err) {
      console.error(`Failed to open ${terminalTitle} terminal:`, err);
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

  const cls = `${btnClass} ${busy ? runClass : idleClass}`;

  return (
    <div>
      <div className="launch-group">
        <button
          onClick={busy ? handleStop : handleBg}
          title={busy ? 'Click to stop' : label}
          className={cls}
        >
          {busy && <span className="system-launch-pulse" />}
          {busy ? activeLabel : label}
        </button>
        <button
          onClick={handleTerminal}
          disabled={busy}
          title={busy ? 'Running...' : 'Open in terminal'}
          className={`launch-terminal-icon ${busy ? 'launch-terminal-icon--disabled' : ''}`}
        >
          {flashing ? '\u2713' : '>_'}
        </button>
      </div>
      {hasOutput && onClearOutput && (
        <div className="mt-6">
          <OutputViewer taskId={taskId} taskName={terminalTitle} output={processOutput} onClear={onClearOutput} />
        </div>
      )}
    </div>
  );
}

export function HealthcheckButton({ processOutput, onClearOutput }: LaunchButtonProps) {
  return (
    <DualLaunchButton
      label={LAUNCH_HEALTHCHECK} activeLabel={LAUNCH_HEALTHCHECK_ACTIVE}
      taskId={TASK_ID_CODEHEALTH} command={LAUNCH_HEALTHCHECK_CMD} terminalTitle="Healthcheck"
      processOutput={processOutput} onClearOutput={onClearOutput}
      btnClass="healthcheck-btn" idleClass="healthcheck-btn--idle" runClass="healthcheck-btn--launched"
    />
  );
}

export function AutofixButton({ processOutput, onClearOutput }: LaunchButtonProps) {
  return (
    <DualLaunchButton
      label={LAUNCH_AUTOFIX} activeLabel={LAUNCH_AUTOFIX_ACTIVE}
      taskId={TASK_ID_AUTOFIX} command={LAUNCH_AUTOFIX_CMD} terminalTitle="Autofix"
      processOutput={processOutput} onClearOutput={onClearOutput}
      btnClass="autofix-btn" idleClass="autofix-btn--idle" runClass="autofix-btn--launched"
    />
  );
}

export { TASK_ID_CODEHEALTH, TASK_ID_AUTOFIX, DualLaunchButton };
