import React, { useState, useRef, useEffect } from 'react';
import { DualLaunchButton } from '../quality/LaunchButtons.tsx';
import type { TaskOutput } from '../../hooks/useProcessOutput.ts';
import { api } from '../../api.ts';
import { OutputViewer } from '../queue/OutputViewer.tsx';
import {
  LAUNCH_RELEASE_STATUS, LAUNCH_RELEASE_STATUS_ACTIVE, LAUNCH_RELEASE_STATUS_CMD,
  LAUNCH_RELEASE_CUT, LAUNCH_RELEASE_CUT_ACTIVE, LAUNCH_RELEASE_CUT_CMD,
  LAUNCH_RELEASE_RETRO, LAUNCH_RELEASE_RETRO_ACTIVE, LAUNCH_RELEASE_RETRO_CMD,
  RELEASE_BUMP_MAJOR, RELEASE_BUMP_MINOR, RELEASE_BUMP_PATCH,
} from '../../constants/strings.ts';

export const TASK_ID_RELEASE_STATUS = -3;
export const TASK_ID_RELEASE_CUT = -4;
export const TASK_ID_RELEASE_RETRO = -5;

type BumpType = 'major' | 'minor' | 'patch';

const BUMP_OPTIONS: { type: BumpType; label: string; hint: string }[] = [
  { type: 'major', label: RELEASE_BUMP_MAJOR, hint: 'Breaking changes' },
  { type: 'minor', label: RELEASE_BUMP_MINOR, hint: 'New features' },
  { type: 'patch', label: RELEASE_BUMP_PATCH, hint: 'Bug fixes' },
];

interface LaunchButtonProps {
  processOutput?: TaskOutput;
  onClearOutput?: (taskId: number) => void;
}

export function ReleaseStatusButton({ processOutput, onClearOutput }: LaunchButtonProps) {
  return (
    <DualLaunchButton
      label={LAUNCH_RELEASE_STATUS} activeLabel={LAUNCH_RELEASE_STATUS_ACTIVE}
      taskId={TASK_ID_RELEASE_STATUS} command={LAUNCH_RELEASE_STATUS_CMD} terminalTitle="Release Status"
      processOutput={processOutput} onClearOutput={onClearOutput}
      btnClass="release-btn" idleClass="release-btn--idle" runClass="release-btn--launched"
    />
  );
}

export function ReleaseCutButton({ processOutput, onClearOutput }: LaunchButtonProps) {
  const [bumpType, setBumpType] = useState<BumpType>('minor');
  const [menuOpen, setMenuOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const pidRef = useRef<number | null>(null);
  const launchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const command = `${LAUNCH_RELEASE_CUT_CMD} ${bumpType}`;
  const running = !!processOutput?.running;
  const busy = running || (launching && !running);
  const hasOutput = (processOutput?.lines.length ?? 0) > 0 || running;

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const clearLaunchTimer = () => {
    if (launchTimerRef.current) { clearTimeout(launchTimerRef.current); launchTimerRef.current = null; }
  };

  const handleTerminal = async () => {
    if (busy) return;
    try {
      await api.launchTerminal(TASK_ID_RELEASE_CUT, command, undefined, 'Release Cut');
      setFlashing(true);
      setTimeout(() => setFlashing(false), 1500);
    } catch (err) {
      console.error('Failed to open Release Cut terminal:', err);
    }
  };

  const handleBg = async (type: BumpType) => {
    if (busy) return;
    setBumpType(type);
    setMenuOpen(false);
    const cmd = `${LAUNCH_RELEASE_CUT_CMD} ${type}`;
    try {
      setLaunching(true);
      clearLaunchTimer();
      launchTimerRef.current = setTimeout(() => setLaunching(false), 10000);
      const res = await api.launch(TASK_ID_RELEASE_CUT, cmd);
      pidRef.current = res.pid;
    } catch (err) {
      console.error('Failed to launch Release Cut:', err);
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
    onClearOutput?.(TASK_ID_RELEASE_CUT);
  };

  const cls = `release-btn ${busy ? 'release-btn--launched' : 'release-btn--idle'}`;

  return (
    <div>
      <div ref={menuRef} className="release-cut-wrapper">
        <div className="release-cut-group">
          <button
            onClick={busy ? handleStop : handleTerminal}
            title={busy ? 'Click to stop' : `Open in terminal: ${command}`}
            className={`${cls} release-cut-main`}
          >
            {busy && <span className="system-launch-pulse" />}
            {busy ? LAUNCH_RELEASE_CUT_ACTIVE : flashing ? 'Opened' : LAUNCH_RELEASE_CUT}
          </button>
          <button
            onClick={() => { if (!busy) setMenuOpen(!menuOpen); }}
            disabled={busy}
            title={busy ? 'Running...' : `Version bump: ${bumpType}`}
            className={`${cls} release-cut-arrow`}
          >
            {busy && <span className="system-launch-pulse" />}
            {'\u25BC'}
          </button>
        </div>

        {menuOpen && (
          <div className="release-cut-menu">
            {BUMP_OPTIONS.map(({ type, label, hint }) => (
              <button
                key={type}
                onClick={() => handleBg(type)}
                className={`release-cut-option ${type === bumpType ? 'release-cut-option--active' : ''}`}
              >
                <span className="release-cut-check">
                  {type === bumpType ? '\u2713' : ''}
                </span>
                <span className="font-500">{label}</span>
                <span className="text-muted text-10 release-cut-hint">{hint}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {hasOutput && onClearOutput && (
        <div className="mt-6">
          <OutputViewer taskId={TASK_ID_RELEASE_CUT} taskName="Release Cut" output={processOutput} onClear={onClearOutput} />
        </div>
      )}
    </div>
  );
}

export function RetroactiveButton({ processOutput, onClearOutput }: LaunchButtonProps) {
  return (
    <DualLaunchButton
      label={LAUNCH_RELEASE_RETRO} activeLabel={LAUNCH_RELEASE_RETRO_ACTIVE}
      taskId={TASK_ID_RELEASE_RETRO} command={LAUNCH_RELEASE_RETRO_CMD} terminalTitle="Retroactive Release"
      processOutput={processOutput} onClearOutput={onClearOutput}
      btnClass="release-btn" idleClass="release-btn--idle" runClass="release-btn--launched"
    />
  );
}
