import {
  addToQueue,
  queueAll,
  queueGroup,
  removeFromQueue,
  clearQueue,
} from 'taskgraph';
import type { StateData, Task } from '../types';

interface UseQueueManagerParams {
  data: StateData | null;
  save: (data: StateData) => void;
  snapshotBeforeAction: (label: string) => void;
}

export function useQueueManager({ data, save, snapshotBeforeAction }: UseQueueManagerParams) {
  const handleQueue = (task: Task) => {
    if (!data) return;
    const result = addToQueue(data, task.id);
    if (result.changed) save(result.state);
  };

  const handleQueueAll = () => {
    if (!data) return;
    const result = queueAll(data);
    if (result.changed) save(result.state);
  };

  const handleQueueGroup = (groupName: string) => {
    if (!data) return;
    const result = queueGroup(data, groupName);
    if (result.changed) save(result.state);
  };

  const handleRemoveFromQueue = (key: number) => {
    if (!data) return;
    const result = removeFromQueue(data, key);
    if (result.changed) save(result.state);
  };

  const handleClearQueue = () => {
    if (!data || (data.queue || []).length === 0) return;
    snapshotBeforeAction('Queue cleared');
    const result = clearQueue(data);
    if (result.changed) save(result.state);
  };

  return {
    handleQueue,
    handleQueueAll,
    handleQueueGroup,
    handleRemoveFromQueue,
    handleClearQueue,
  };
}
