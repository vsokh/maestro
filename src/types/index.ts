export type TaskStatus = 'pending' | 'in-progress' | 'done' | 'blocked' | 'paused' | 'backlog';

export interface Attachment {
  id: string;
  filename: string;
  path?: string;
}

export interface HistoryEntry {
  status: string;
  at: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  type: 'skill' | 'agent';
}

export interface EpicMapping {
  skills: string[];
  agents: string[];
}

export interface SkillsConfig {
  epics: Record<string, EpicMapping>;
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
}

export interface StateData {
  savedAt?: string;
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

export interface Feature {
  id: string;
  name: string;
  description?: string;
}

export interface QualityDimension {
  score: number;
  grade: string;
  weight: string;
  confidence: string;
  evidence?: string;
  issues: number;
  findings?: QualityFinding[];
  recommendation?: string;
}

export interface QualityFinding {
  id?: string;
  severity: string;
  dimension?: string;
  file?: string;
  line?: number;
  finding: string;
  fix?: string;
  effort?: string;
}

export interface QualityBaseline {
  buildPasses?: boolean;
  lintErrors?: number;
  testsPassing?: boolean;
  testCount?: number;
  testCoveragePercent?: number;
  bundleGzipKB?: number;
  depVulnerabilities?: {
    critical?: number;
    high?: number;
    moderate?: number;
    low?: number;
    total?: number;
  };
  sentry?: {
    unresolvedCount?: number;
    crashFreeRate?: number;
    weeklyErrorCount?: number;
  };
}

export interface QualityReport {
  overallScore: number;
  grade: string;
  dimensions: Record<string, QualityDimension>;
  baseline?: QualityBaseline;
  topFindings?: QualityFinding[];
  scannedAt?: string;
  filesScanned?: number;
  commitRef?: string;
  date?: string;
}

export interface QualityHistoryEntry {
  date: string;
  overallScore: number;
  grade?: string;
  commitRef?: string;
  dimensions?: Record<string, { score: number } | number>;
}

export interface EpicColor {
  bg: string;
  text: string;
  border: string;
}

export interface UndoEntry {
  data: StateData;
  label: string;
  timestamp: number;
}
