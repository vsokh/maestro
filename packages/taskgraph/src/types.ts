export const TASK_STATUSES = ['pending', 'in-progress', 'done', 'blocked', 'paused', 'backlog'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Attachment {
  id: string;
  filename: string;
  path?: string;
}

export interface HistoryEntry {
  status: string;
  at: string;
}

export interface Task {
  id: number;
  name: string;
  fullName?: string;
  description?: string;
  status: TaskStatus;
  group?: string;
  skills?: string[];
  manual?: boolean;
  supervision?: boolean;
  autoApprove?: boolean;
  progress?: string;
  blockedReason?: string;
  lastProgress?: string;
  branch?: string;
  attachments?: Attachment[];
  dependsOn?: number[];
  createdAt?: string;
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  commitRef?: string;
  history?: HistoryEntry[];
  engine?: string;
  summary?: string;
}

export interface QueueItem {
  task: number;
  taskName: string;
  notes?: string;
}

export interface Epic {
  name: string;
  color?: number;
  hidden?: boolean;
}

export interface Activity {
  id: string;
  time: number;
  label: string;
  taskId?: number;
  commitRef?: string;
  filesChanged?: number;
  changes?: string[];
}

export interface ProgressEntry {
  status: 'in-progress' | 'done' | 'paused';
  progress?: string;
  completedAt?: string;
  commitRef?: string;
  branch?: string;
  label?: string;
  filesChanged?: number;
  changes?: string[];
  summary?: string;
  taskUpdates?: Record<string, { dependsOn?: number[]; group?: string }>;
}

export interface Feature {
  id: string;
  name: string;
  description?: string;
}

export interface StateData {
  savedAt?: string;
  _v?: number;
  project: string;
  tasks: Task[];
  queue: QueueItem[];
  taskNotes: Record<string, string>;
  activity: Activity[];
  epics?: Epic[];
  features?: Feature[];
  defaultEngine?: string;
  scratchpad?: string;
}
