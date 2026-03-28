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
  const [splitResult, setSplitResult] = useState<{ name: string }[] | null>(null);
  const splitResultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSplitTasks = useCallback(async (text: string) => {
    if (!data) return;
    setSplitting(true);
    try {
      const result = await api.splitTasks(text);
      if (result.tasks && result.tasks.length > 0) {
        const maxId = Math.max(0, ...data.tasks.map(t => t.id));
        const newTasks = result.tasks.map((t, i) => ({
          id: maxId + i + 1,
          name: t.name,
          fullName: t.fullName || t.name,
          description: t.description || '',
          status: 'pending' as const,
          group: t.group || undefined,
          createdAt: new Date().toISOString(),
        }));
        const existingEpics = new Set((data.epics || []).map(e => e.name));
        const newEpics = [...(data.epics || [])];
        for (const t of newTasks) {
          if (t.group && !existingEpics.has(t.group)) {
            newEpics.push({ name: t.group, color: newEpics.length });
            existingEpics.add(t.group);
          }
        }
        const activity = [
          { id: 'act_split_' + Date.now(), time: Date.now(), label: `${newTasks.length} tasks created from scratchpad` },
          ...(data.activity || []),
        ];
        save({ ...data, tasks: [...data.tasks, ...newTasks], epics: newEpics, activity, scratchpad: '' });

        setSplitResult(newTasks.map(t => ({ name: t.name })));
        if (splitResultTimer.current) clearTimeout(splitResultTimer.current);
        splitResultTimer.current = setTimeout(() => setSplitResult(null), 8000);

        try {
          await api.launch(0, '/orchestrator arrange');
        } catch { /* arrange is best-effort */ }
      }
    } catch (err: unknown) {
      showError('Failed to split tasks: ' + (err instanceof Error ? err.message : 'unknown'));
    } finally {
      setSplitting(false);
    }
  }, [data, save, showError]);

  return { showScratchpad, setShowScratchpad, splitting, splitResult, setSplitResult, splitResultTimer, handleSplitTasks };
}
