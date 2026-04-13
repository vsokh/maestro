import { useState, useCallback, useRef } from 'react';
import { api } from '../api.ts';
import type { StateData } from '../types';

interface UseScratchpadParams {
  data: StateData | null;
  save: (data: StateData) => void;
  showError: (msg: string) => void;
}

export function useScratchpad({ data, save, showError }: UseScratchpadParams) {
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [splitResult, setSplitResult] = useState<{ name: string }[] | null>(null);
  const splitResultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const arrangeAndFinish = useCallback(async (newTasks: Array<{ name: string }>) => {
    // Arrange: set dependencies and compute phases before showing results
    setArranging(true);
    try {
      const { pid } = await api.launch(0, '/orchestrator arrange');
      const start = Date.now();
      while (Date.now() - start < 120000) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const procs = await api.listProcesses();
          if (!procs.some(p => p.pid === pid)) break;
        } catch { break; }
      }
    } catch { /* arrange is best-effort */ }

    setSplitResult(newTasks);
    if (splitResultTimer.current) clearTimeout(splitResultTimer.current);
    splitResultTimer.current = setTimeout(() => setSplitResult(null), 8000);
    setShowScratchpad(false);
  }, []);

  const handleSplitTasks = useCallback(async (text: string, terminal?: boolean) => {
    if (!data) return;
    setSplitting(true);
    try {
      if (terminal) {
        // Terminal mode: open Claude in a terminal, poll for result file
        await api.splitTasks(text, true);
        setSplitting(false);
        setArranging(true); // reuse arranging state for "waiting for terminal"

        const start = Date.now();
        let result = null;
        while (Date.now() - start < 180000) {
          await new Promise(r => setTimeout(r, 3000));
          result = await api.readSplitResult();
          if (result) break;
        }

        if (result) {
          const freshData = data; // data ref from closure
          const newTasks = createTasksFromResult(result, freshData);
          if (newTasks) {
            await arrangeAndFinish(newTasks.map(t => ({ name: t.name })));
          }
        } else {
          showError('Split timed out — check the terminal window');
        }
      } else {
        // Background mode: server runs Claude and returns result
        const result = await api.splitTasks(text);
        if (result.tasks && result.tasks.length > 0) {
          const newTasks = createTasksFromResult(result as { tasks: Array<{ name: string; fullName: string; description: string; group?: string }> }, data);
          if (newTasks) {
            await arrangeAndFinish(newTasks.map(t => ({ name: t.name })));
          }
        }
      }
    } catch (err: unknown) {
      showError('Failed to split tasks: ' + (err instanceof Error ? err.message : 'unknown'));
    } finally {
      setSplitting(false);
      setArranging(false);
    }
  }, [data, createTasksFromResult, arrangeAndFinish, showError]);

  return { showScratchpad, setShowScratchpad, splitting, arranging, splitResult, setSplitResult, splitResultTimer, handleSplitTasks };
}
