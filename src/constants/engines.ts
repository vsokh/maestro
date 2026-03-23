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
