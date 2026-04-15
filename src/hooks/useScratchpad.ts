import { useState, useCallback, useRef } from 'react';
import { api } from '../api.ts';
import { resolveModel } from '../constants/engines.ts';
import type { StateData } from '../types';

interface UseScratchpadParams {
  data: StateData | null;
  save: (data: StateData) => void;
  showError: (msg: string) => void;
}

export function useScratchpad({ data, save, showError }: UseScratchpadParams) {
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [splitResult, setSplitResult] = useState<{ name: string }[] | null>(null);
  const splitResultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishSplit = useCallback((newTasks: Array<{ id: number; name: string }>) => {
    setSplitResult(newTasks.map(t => ({ name: t.name })));
    if (splitResultTimer.current) clearTimeout(splitResultTimer.current);
    splitResultTimer.current = setTimeout(() => setSplitResult(null), 8000);
    setShowScratchpad(false);

    // Arrange in background — don't block the UI
    const arrangeModel = resolveModel('/orchestrator arrange', undefined, data?.defaultModel);
    api.launch(0, '/orchestrator arrange', undefined, arrangeModel).catch(() => { /* best-effort */ });
  }, [data?.defaultModel]);

  const createTasksFromResult = useCallback((
    result: { tasks: Array<{ name: string; fullName: string; description: string; group?: string }> },
    currentData: StateData,
  ) => {
    if (!result.tasks || result.tasks.length === 0) return null;
    const maxId = Math.max(0, ...currentData.tasks.map(t => t.id));
    const newTasks = result.tasks.map((t, i) => ({
      id: maxId + i + 1,
      name: t.name,
      fullName: t.fullName || t.name,
      description: t.description || '',
      status: 'pending' as const,
      group: t.group || undefined,
      createdAt: new Date().toISOString(),
    }));
    const existingEpics = new Set((currentData.epics || []).map(e => e.name));
    const newEpics = [...(currentData.epics || [])];
    for (const t of newTasks) {
      if (t.group && !existingEpics.has(t.group)) {
        newEpics.push({ name: t.group, color: newEpics.length });
        existingEpics.add(t.group);
      }
    }
    const activity = [
      { id: 'act_split_' + Date.now(), time: Date.now(), label: `${newTasks.length} tasks created from scratchpad` },
      ...(currentData.activity || []),
    ];
    save({ ...currentData, tasks: [...currentData.tasks, ...newTasks], epics: newEpics, activity, scratchpad: '' });
    return newTasks;
  }, [save]);

  const handleSplitTasks = useCallback(async (text: string, terminal?: boolean) => {
    if (!data) return;
    setSplitting(true);
    try {
      if (terminal) {
        // Terminal mode: open interactive Claude session, poll for result file
        await api.splitTasks(text, true);

        const start = Date.now();
        let result = null;
        while (Date.now() - start < 180000) {
          await new Promise(r => setTimeout(r, 3000));
          result = await api.readSplitResult();
          if (result) break;
        }

        if (result) {
          const newTasks = createTasksFromResult(result, data);
          if (newTasks) finishSplit(newTasks);
        } else {
          showError('Split timed out — check the terminal window');
        }
      } else {
        // Background mode: server runs Claude and returns result
        const result = await api.splitTasks(text);
        if (result.tasks && result.tasks.length > 0) {
          const newTasks = createTasksFromResult(
            result as { tasks: Array<{ name: string; fullName: string; description: string; group?: string }> },
            data,
          );
          if (newTasks) finishSplit(newTasks);
        }
      }
    } catch (err: unknown) {
      showError('Failed to split tasks: ' + (err instanceof Error ? err.message : 'unknown'));
    } finally {
      setSplitting(false);
    }
  }, [data, createTasksFromResult, finishSplit, showError]);

  return { showScratchpad, setShowScratchpad, splitting, splitResult, setSplitResult, splitResultTimer, handleSplitTasks };
}
