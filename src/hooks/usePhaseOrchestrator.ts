import { useState, useRef, type MutableRefObject } from 'react';
import { api } from '../api.ts';
import { resolveModel } from '../constants/engines.ts';
import { computePhases } from '../utils/computePhases.ts';
import { itemKey, cmdForItem } from '../components/queue/queueItemUtils.ts';
import type { StateData, QueueItem } from '../types';
import type { LaunchMode } from './useQueueActions.ts';

interface LaunchPhaseItem {
  key: number;
  cmd: string;
  taskName: string;
}

/** Max output lines to inject as context per dependency task */
const CONTEXT_MAX_LINES = 30;
const CONTEXT_MARKER = '\n\n---\n## Context from prerequisite tasks';

interface UsePhaseOrchestratorParams {
  dataRef: MutableRefObject<StateData | null>;
  save: (data: StateData) => void;
  launchMode: LaunchMode;
  waitForProcess: (pid: number, timeout?: number) => Promise<boolean>;
  onError: (msg: string) => void;
}

export function usePhaseOrchestrator({ dataRef, save, launchMode, waitForProcess, onError }: UsePhaseOrchestratorParams) {
  const [arranging, setArranging] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelinePhase, setPipelinePhase] = useState(-1);
  const pipelineCancelRef = useRef(false);

  /** Inject output from completed dependency tasks into next phase tasks' notes */
  const injectPhaseContext = async (currentPhaseIdx: number, phases: QueueItem[][]) => {
    const fresh = dataRef.current;
    if (!fresh) return;

    // Collect all task IDs from previous phases
    const prevTaskIds = new Set<number>();
    for (let i = 0; i < currentPhaseIdx; i++) {
      for (const item of phases[i]) prevTaskIds.add(item.task);
    }

    // Fetch buffered output from server
    let buffered: Record<string, { output: Array<{ text: string; stream: string; time: number }>; running: boolean; exitCode?: number }> = {};
    try {
      buffered = await api.getBufferedOutput();
    } catch { /* no output available */ }

    const taskMap = new Map((fresh.tasks || []).map(t => [t.id, t]));
    const taskNotes = { ...(fresh.taskNotes || {}) };
    let hasUpdates = false;

    for (const item of phases[currentPhaseIdx]) {
      const task = taskMap.get(item.task);
      if (!task) continue;

      // Find dependencies that ran in previous phases
      const deps = (task.dependsOn || []).filter(d => prevTaskIds.has(d));
      if (deps.length === 0) continue;

      const contextParts: string[] = [];
      for (const depId of deps) {
        const depTask = taskMap.get(depId);
        const depOutput = buffered[String(depId)];
        if (!depTask && !depOutput) continue;

        let part = `### ${depTask?.name || `Task #${depId}`}`;
        if (depTask?.progress) part += `\nStatus: ${depTask.progress}`;

        if (depOutput?.output?.length) {
          const lines = depOutput.output.slice(-CONTEXT_MAX_LINES).map(l => l.text).join('\n');
          part += `\nOutput (last ${CONTEXT_MAX_LINES} lines):\n\`\`\`\n${lines}\n\`\`\``;
        }
        contextParts.push(part);
      }

      if (contextParts.length === 0) continue;

      // Strip previous context section from taskNotes, append new one
      const existingNotes = taskNotes[String(task.id)] || '';
      const baseNotes = existingNotes.split(CONTEXT_MARKER)[0].trimEnd();
      taskNotes[String(task.id)] = baseNotes + CONTEXT_MARKER + '\n' + contextParts.join('\n\n');
      hasUpdates = true;
    }

    if (hasUpdates) {
      const freshNow = dataRef.current;
      if (freshNow) {
        save({ ...freshNow, taskNotes });
      }
    }
  };

  const resolveTaskModel = (taskId: number, cmd: string): string | undefined => {
    const d = dataRef.current;
    const task = (d?.tasks || []).find(t => t.id === taskId);
    return resolveModel(cmd, task?.model, d?.defaultModel, task);
  };

  /** Launch all phases sequentially — tasks within each phase run in parallel */
  const handleLaunchPipeline = async () => {
    const fresh = dataRef.current;
    if (!fresh) return;

    const phases = computePhases(fresh.queue || [], fresh.tasks || []);
    if (!phases || phases.length === 0) return;

    setPipelineRunning(true);
    pipelineCancelRef.current = false;

    try {
      for (let phaseIdx = 0; phaseIdx < phases.length; phaseIdx++) {
        if (pipelineCancelRef.current) break;
        setPipelinePhase(phaseIdx);

        const phaseItems = phases[phaseIdx];

        // Inject context from completed dependency tasks
        if (phaseIdx > 0) {
          await injectPhaseContext(phaseIdx, phases);
        }

        // Build launch list, skip tasks already running or done
        const freshNow = dataRef.current;
        const freshTasks = freshNow?.tasks || [];
        const skipIds = new Set(
          freshTasks.filter(t => t.status === 'done' || t.status === 'in-progress').map(t => t.id)
        );
        const toLaunch = phaseItems
          .map(item => ({ key: itemKey(item), cmd: cmdForItem(item), taskName: item.taskName }))
          .filter(i => !skipIds.has(i.key));

        if (toLaunch.length === 0) continue;

        // Mark all tasks as launching
        if (freshNow) {
          const launchingIds = new Set(toLaunch.map(i => i.key));
          const tasks = (freshNow.tasks || []).map(t =>
            launchingIds.has(t.id) ? { ...t, status: 'in-progress' as const, progress: 'Launching...', startedAt: t.startedAt || new Date().toISOString() } : t
          );
          save({ ...freshNow, tasks });
        }

        // Launch all tasks in this phase and collect PIDs
        const pids: number[] = [];
        for (const item of toLaunch) {
          if (pipelineCancelRef.current) break;
          try {
            const model = resolveTaskModel(item.key, item.cmd);
            const { pid } = await api.launch(item.key, item.cmd, undefined, model);
            pids.push(pid);
          } catch (err) {
            console.error(`Failed to launch task ${item.key}:`, err);
          }
        }

        // Wait for ALL tasks in this phase to complete
        if (pids.length > 0) {
          await Promise.all(pids.map(pid => waitForProcess(pid)));
        }
      }
    } catch (err) {
      console.error('Pipeline failed:', err);
      onError(`Pipeline failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setPipelineRunning(false);
      setPipelinePhase(-1);
    }
  };

  const cancelPipeline = () => {
    pipelineCancelRef.current = true;
  };

  const handleLaunchPhase = async (items: LaunchPhaseItem[], phaseIndex?: number) => {
    let verified = items;
    try {
      // Re-verify phase membership against latest data to prevent launching
      // tasks that moved to a different phase between render and click
      const fresh = dataRef.current;
      if (fresh && phaseIndex != null) {
        const phases = computePhases(fresh.queue || [], fresh.tasks || []);
        if (phases && phases[phaseIndex]) {
          const phaseTaskIds = new Set(phases[phaseIndex].map(q => q.task));
          verified = items.filter(i => phaseTaskIds.has(i.key));
        }
      }
      // Skip tasks already running
      const freshTasks = (dataRef.current?.tasks || []);
      const runningIds = new Set(freshTasks.filter(t => t.status === 'in-progress').map(t => t.id));
      verified = verified.filter(i => !runningIds.has(i.key));
      if (verified.length === 0) return;

      if (launchMode === 'sequential') {
        // Sequential: launch one at a time, wait for each to finish
        for (const item of verified) {
          const freshNow = dataRef.current;
          if (freshNow) {
            const tasks = (freshNow.tasks || []).map(t =>
              t.id === item.key ? { ...t, status: 'in-progress' as const, progress: 'Launching...', startedAt: t.startedAt || new Date().toISOString() } : t
            );
            save({ ...freshNow, tasks });
          }
          const model = resolveTaskModel(item.key, item.cmd);
          const { pid } = await api.launch(item.key, item.cmd, undefined, model);
          await waitForProcess(pid);
        }
      } else {
        // Parallel: batch-set all tasks to 'Launching...' then launch all
        if (fresh) {
          const launchingIds = new Set(verified.map(i => i.key));
          const tasks = (fresh.tasks || []).map(t =>
            launchingIds.has(t.id) ? { ...t, status: 'in-progress' as const, progress: 'Launching...', startedAt: t.startedAt || new Date().toISOString() } : t
          );
          save({ ...fresh, tasks });
        }
        for (const item of verified) {
          const model = resolveTaskModel(item.key, item.cmd);
          if (launchMode === 'terminal') {
            try {
              await api.launchTerminal(item.key, item.cmd, undefined, item.taskName, model);
            } catch (err) {
              console.error('Failed to launch task in terminal:', err);
            }
          } else {
            await api.launch(item.key, item.cmd, undefined, model);
          }
        }
      }
    } catch (err) {
      console.error('Failed to launch phase:', err);
      const freshNow = dataRef.current;
      if (freshNow) {
        const launchingIds = new Set(verified.map(i => i.key));
        const resetTasks = (freshNow.tasks || []).map(t =>
          launchingIds.has(t.id) && t.progress === 'Launching...'
            ? { ...t, status: 'pending' as const, progress: undefined }
            : t
        );
        save({ ...freshNow, tasks: resetTasks });
      }
      onError(`Failed to launch phase: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleRetryFailed = async (items: LaunchPhaseItem[], phaseIndex?: number) => {
    // Filter to only errored tasks
    const fresh = dataRef.current;
    if (!fresh) return;
    const taskMap = new Map((fresh.tasks || []).map(t => [t.id, t]));
    const errored = items.filter(i => {
      const task = taskMap.get(i.key);
      if (!task || task.status !== 'in-progress') return false;
      const p = (task.progress || '').toLowerCase();
      return /exited with code|error|failed|limit|blocked/i.test(p);
    });
    if (errored.length === 0) return;
    // Reset errored tasks to pending first, then launch
    const resetTasks = (fresh.tasks || []).map(t =>
      errored.some(e => e.key === t.id) ? { ...t, status: 'pending' as const, progress: undefined } : t
    );
    save({ ...fresh, tasks: resetTasks });
    await handleLaunchPhase(errored, phaseIndex);
  };

  const handleArrange = async () => {
    try {
      setArranging(true);
      const model = resolveModel('/orchestrator arrange', undefined, dataRef.current?.defaultModel);
      await api.launch(0, '/orchestrator arrange', undefined, model);
    } catch (err) {
      console.error('Failed to launch arrange:', err);
      onError(`Failed to launch arrange: ${err instanceof Error ? err.message : err}`);
      setArranging(false);
    }
  };

  return {
    arranging,
    setArranging,
    handleLaunchPhase,
    handleRetryFailed,
    handleArrange,
    handleLaunchPipeline,
    cancelPipeline,
    pipelineRunning,
    pipelinePhase,
  };
}
