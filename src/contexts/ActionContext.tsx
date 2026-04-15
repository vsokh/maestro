import { createContext, useContext } from 'react';
import type { Task, Epic } from '../types';
import type { LaunchMode } from '../hooks/useQueueActions.ts';

export interface ActionContextValue {
  // Task actions
  handleUpdateTask: (id: number, updates: Partial<Task>) => void;
  handleBatchUpdateTasks: (updates: Array<{ id: number; updates: Partial<Task> }>) => void;
  handleUpdateNotes: (id: number, note: string) => void;
  handleAddTask: (task: Partial<Task>) => void;
  handleRenameGroup: (oldName: string, newName: string) => void;
  handleDeleteGroup: (groupName: string) => void;
  handleUpdateEpics: (epics: Epic[]) => void;
  handleDeleteTask: (id: number) => void;
  handleAddAttachment: (taskId: number, file: File) => void;
  handleDeleteAttachment: (taskId: number, attachmentId: string) => void;

  // Queue actions
  handleQueue: (task: Task) => void;
  handleQueueAll: () => void;
  handleQueueGroup: (group: string) => void;
  handleRemoveFromQueue: (key: number) => void;
  handleClearQueue: () => void;
  handleLaunchTask: (key: number, cmd: string, taskName: string) => void;
  handleLaunchPhase: (items: { key: number; cmd: string; taskName: string }[], phaseIndex?: number) => void;
  handleRetryFailed: (items: { key: number; cmd: string; taskName: string }[], phaseIndex?: number) => void;
  handleLaunchTerminal: (key: number, cmd: string, taskName: string) => void;
  handleArrange: () => void;
  handleLaunchPipeline: () => void;
  cancelPipeline: () => void;
  launchedIds: Set<number>;
  launchMode: LaunchMode;
  setLaunchMode: (mode: LaunchMode) => void;
  arranging: boolean;
  setArranging: (v: boolean) => void;
  pipelineRunning: boolean;
  pipelinePhase: number;

  // Project actions
  pauseTask: (id: number) => void;
  cancelTask: (id: number) => void;

  // Selection
  selectedTask: number | null;
  handleSelectTask: (id: number | null) => void;
  handleNavigateToTask: (taskId: number) => void;
  glowTaskId: number | null;

  // Multi-select / bulk actions
  selectMode: boolean;
  selectedTasks: Set<number>;
  onToggleSelectMode: () => void;
  onToggleTaskSelection: (id: number) => void;
  onBulkDelete: () => void;
  onBulkStatusChange: (status: string) => void;
  onExitSelectMode: () => void;

  // Activity
  handleRemoveActivity: (id: string) => void;

  // Config
  defaultEngine: string | undefined;
  defaultModel: string | undefined;
}

const ActionContext = createContext<ActionContextValue | null>(null);

export const ActionProvider = ActionContext.Provider;

export function useActions(): ActionContextValue {
  const ctx = useContext(ActionContext);
  if (!ctx) throw new Error('useActions must be used within ActionProvider');
  return ctx;
}
