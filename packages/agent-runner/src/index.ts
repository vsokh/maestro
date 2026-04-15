// agent-runner — AI agent process lifecycle management
// Spawn, stream, buffer, kill — through injected ports. No real I/O.

// Types & Ports
export type {
  SpawnPort, SpawnOptions, ProcessHandle,
  BroadcastPort, ProgressWriterPort,
  EngineAdapter, AgentEvent,
  LaunchResult, ProcessInfo, OutputLine, TaskOutput,
} from './types.js';

// Constants
export { MAX_OUTPUT_LINES, FALLBACK_PROGRESS_WINDOW_MS, SUPPORTED_ENGINES, SUPPORTED_MODELS } from './constants.js';

// Prompt builder (pure)
export { buildClaudePrompt, DEFAULT_ENGINES } from './prompt-builder.js';

// Process manager
export { ProcessManager } from './process-manager.js';
