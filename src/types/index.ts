// Core types re-exported from engine
export type {
  Task, TaskStatus, QueueItem, ProgressEntry, StateData,
  Activity, Epic, Feature, Attachment, HistoryEntry,
} from 'taskgraph';
export { TASK_STATUSES } from 'taskgraph';

// Product-specific types (not in engine)

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
  note?: string;
  dimensions?: Record<string, { score: number } | number>;
}

export interface EpicColor {
  bg: string;
  text: string;
  border: string;
}

export interface UndoEntry {
  data: import('taskgraph').StateData;
  label: string;
  timestamp: number;
}

// WebSocket message types (discriminated union)
export interface StateMessage {
  type: 'state';
  data: import('taskgraph').StateData;
  lastModified: number;
}

export interface ProgressMessage {
  type: 'progress';
  data: Record<string, import('taskgraph').ProgressEntry>;
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
