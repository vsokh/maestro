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

// WebSocket message types (discriminated union)
export interface StateMessage {
  type: 'state';
  data: StateData;
  lastModified: number;
}

export interface ProgressMessage {
  type: 'progress';
  data: Record<string, ProgressEntry>;
}

export interface QualityMessage {
  type: 'quality';
  data: QualityReport;
}

export interface ProjectSwitchedMessage {
  type: 'project-switched';
}

export interface OutputMessage {
  type: 'output';
  taskId: number;
  text: string;
  stream?: 'stdout' | 'stderr';
  pid?: number;
}

export interface ExitMessage {
  type: 'exit';
  taskId: number;
  code?: number;
  error?: string;
}

export type WebSocketMessage = StateMessage | ProgressMessage | QualityMessage | ProjectSwitchedMessage | OutputMessage | ExitMessage;

// Release types
export interface ReleaseEntry {
  version: string;
  date: string;
  commitRef: string;
  stabilityScore: number;
  commitCount: number;
  description?: string;
  breakdown?: Record<string, number>;
  gateResults?: Record<string, 'pass' | 'warn' | 'fail'>;
}

export interface ChangelogGroup {
  name: string;
  items: string[];
}

export interface ChangelogSection {
  version: string;
  date: string;
  groups: ChangelogGroup[];
}

export interface StabilityAssessment {
  score: number;
  level: 'Stable' | 'Release Candidate' | 'Stabilizing' | 'Active Development';
  components?: {
    buildTest: number;
    codehealth: number;
    fixRatio: number;
    backlog: number;
    regression: number;
    fixDecay: number;
  };
  gateResults?: Record<string, 'pass' | 'warn' | 'fail'>;
  assessedAt: string;
  commitRef?: string;
  currentVersion?: string;
  commitsSinceRelease?: number;
}
