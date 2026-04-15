// Engine definitions for the multi-engine launch feature.
// Each engine represents an AI coding assistant that can execute tasks.

export interface EngineConfig {
  id: string;
  label: string;
  color: string;
  icon: string;        // Single unicode character or short text
  command: string;     // CLI command prefix used for launching
}

export const ENGINES: EngineConfig[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    color: 'var(--dm-accent)',
    icon: '\u25C8',       // diamond with dot
    command: 'claude',
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    color: 'var(--dm-success)',
    icon: '\u25A3',       // filled square
    command: 'codex',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    color: 'var(--dm-paused)',
    icon: '\u25C9',       // circle with dot
    command: 'cursor',
  },
];

export const DEFAULT_ENGINE_ID = 'claude';

export function getEngine(id: string | undefined): EngineConfig {
  return ENGINES.find(e => e.id === id) || ENGINES[0];
}

// --- Model definitions for Claude engine ---

export interface ModelConfig {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  tier: 'fast' | 'balanced' | 'powerful';
}

export const MODELS: ModelConfig[] = [
  {
    id: 'opus',
    label: 'Opus',
    shortLabel: 'Op',
    color: 'var(--dm-accent)',
    tier: 'powerful',
  },
  {
    id: 'sonnet',
    label: 'Sonnet',
    shortLabel: 'So',
    color: 'var(--dm-success)',
    tier: 'balanced',
  },
  {
    id: 'haiku',
    label: 'Haiku',
    shortLabel: 'Ha',
    color: 'var(--dm-amber)',
    tier: 'fast',
  },
];

export function getModel(id: string | undefined): ModelConfig {
  return MODELS.find(m => m.id === id) || MODELS[0];
}

/** Signals that suggest a task needs the most capable model */
const OPUS_PATTERNS = /\b(architect|redesign|migration|refactor large|rethink|complex|security audit|breaking change|cross-cutting)\b/i;

/** Signals that a task is simple enough for the fast model */
const SONNET_PATTERNS = /\b(fix typo|rename|bump version|update (text|copy|string|label|readme)|config change|add test|lint|format|style|css|color|padding|margin|font|spacing|icon|image|alt text|placeholder)\b/i;

interface TaskHint {
  name?: string;
  description?: string;
  skills?: string[];
}

/**
 * Auto-route model based on command + task content.
 * System commands → sonnet. Task execution → analyze task name/description.
 */
export function resolveModel(command: string, taskModel?: string, defaultModel?: string, task?: TaskHint): string | undefined {
  // Explicit per-task override wins
  if (taskModel) return taskModel;

  // System commands — always cheap
  if (/^\/codehealth/.test(command)) return 'sonnet';
  if (/^\/autofix/.test(command)) return 'sonnet';
  if (/^\/orchestrator\s+arrange/.test(command)) return 'sonnet';
  if (/^\/error-tracker/.test(command)) return 'sonnet';
  if (/^\/release/.test(command)) return 'sonnet';

  // Task execution — analyze task content
  if (/^\/orchestrator\s+task\s+\d+/.test(command) && task) {
    const text = [task.name, task.description].filter(Boolean).join(' ');

    // If task text strongly signals complexity → opus
    if (OPUS_PATTERNS.test(text)) return 'opus';

    // If task text signals simplicity → sonnet
    if (SONNET_PATTERNS.test(text)) return 'sonnet';
  }

  // Fallback: project default, or sonnet as the cost-effective baseline
  return defaultModel || 'sonnet';
}
