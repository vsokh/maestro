import { useState } from 'react';
import { useQueueManager } from './useQueueManager.ts';
import { useTaskLauncher } from './useTaskLauncher.ts';
import { usePhaseOrchestrator } from './usePhaseOrchestrator.ts';
import type { StateData } from '../types';

interface UseQueueActionsParams {
  data: StateData | null;
  save: (data: StateData) => void;
  snapshotBeforeAction: (label: string) => void;
  onError: (msg: string) => void;
}

export type LaunchMode = 'background' | 'sequential' | 'terminal';

export function useQueueActions({ data, save, snapshotBeforeAction, onError }: UseQueueActionsParams) {
  const [launchedIds] = useState<Set<number>>(new Set());
  const [launchMode, setLaunchMode] = useState<LaunchMode>('background');

  const {
    handleQueue,
    handleQueueAll,
    handleQueueGroup,
    handleRemoveFromQueue,
    handleClearQueue,
  } = useQueueManager({ data, save, snapshotBeforeAction });

  const {
    dataRef,
    handleLaunchTask,
    handleLaunchTerminal,
    waitForProcess,
  } = useTaskLauncher({ data, save, launchMode, onError });

  const {
    arranging,
    setArranging,
    handleLaunchPhase,
    handleRetryFailed,
    handleArrange,
    handleLaunchPipeline,
    cancelPipeline,
    pipelineRunning,
    pipelinePhase,
  } = usePhaseOrchestrator({ dataRef, save, launchMode, waitForProcess, onError });

  return {
    launchedIds,
    launchMode,
    setLaunchMode,
    arranging,
    setArranging,
    handleQueue,
    handleQueueAll,
    handleQueueGroup,
    handleRemoveFromQueue,
    handleClearQueue,
    handleLaunchTask,
    handleLaunchPhase,
    handleRetryFailed,
    handleLaunchTerminal,
    handleArrange,
    handleLaunchPipeline,
    cancelPipeline,
    pipelineRunning,
    pipelinePhase,
  };
}
