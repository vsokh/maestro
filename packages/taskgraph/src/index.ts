// taskgraph — task state machine with dependency-aware ordering
// Pure functions: state in → new state out. No I/O, no React, no HTTP.

// Types
export type { Task, TaskStatus, QueueItem, ProgressEntry, StateData, Activity, Epic, Feature, Attachment, HistoryEntry } from './types.js';
export { TASK_STATUSES } from './types.js';

// Constants
export { STATUS, DEFAULT_ACTIVITY_LIMIT } from './constants.js';

// Queue
export { sortByDependencies } from './queue/sort.js';
export { computePhases } from './queue/phases.js';
export { addToQueue, queueAll, queueGroup, removeFromQueue, clearQueue } from './queue/operations.js';
export type { QueueResult } from './queue/operations.js';

// State merging
export { mergeProgressIntoState, protectDoneTaskRegression } from './state/merge.js';
export type { MergeResult } from './state/merge.js';

// State validation
export { validateState, validateProgress, validateStateStructure, validateStateStrict, fixInconsistentTasks } from './state/validate.js';

// Version guards
export { isStaleVersion, incrementVersion } from './state/version.js';

// Tasks
export { createActivityList } from './tasks/activity.js';
export { getActiveTasks, getDoneTasks, getBacklogTasks, getUnqueuedTasks, getAllGroups } from './tasks/filters.js';
export { addTask, updateTask, batchUpdateTasks, updateNotes, deleteTask, bulkDeleteTasks, renameGroup, deleteGroup } from './tasks/operations.js';
