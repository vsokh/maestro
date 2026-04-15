// --- Port: Process Spawner ---

export interface SpawnOptions {
  cwd: string;
  env?: Record<string, string>;
}

export interface ProcessHandle {
  readonly pid: number;
  onStdout(cb: (text: string) => void): void;
  onStderr(cb: (text: string) => void): void;
  onClose(cb: (code: number | null) => void): void;
  onError(cb: (err: Error) => void): void;
  kill(): void;
}

export interface SpawnPort {
  spawn(cmd: string, args: string[], opts: SpawnOptions): ProcessHandle;
}

// --- Port: Progress Writer (fallback on exit) ---

export interface ProgressWriterPort {
  wasRecentlyWritten(projectPath: string, taskId: number, windowMs: number): Promise<boolean>;
  writeFallbackProgress(projectPath: string, taskId: number, entry: { status: string; progress: string }): Promise<void>;
}

// --- Port: Broadcast ---

export interface BroadcastPort {
  send(message: AgentEvent): void;
}

// --- Events ---

export type AgentEvent =
  | { type: 'output'; taskId: number; pid: number; text: string; stream?: 'stderr' }
  | { type: 'exit'; taskId: number; pid: number; code: number | null; error?: string }
  | { type: 'error'; taskId: number; message: string };

// --- Engine adapter ---

export interface EngineAdapter {
  (command: string, model?: string): { cmd: string; args: string[] };
}

// --- Results ---

export interface LaunchResult {
  pid: number;
}

export interface ProcessInfo {
  pid: number;
  taskId: number;
  engine: string;
  startedAt: string;
}

export interface OutputLine {
  text: string;
  stream: 'stdout' | 'stderr';
  time: number;
}

export interface TaskOutput {
  output: OutputLine[];
  running: boolean;
  exitCode?: number | null;
  error?: string;
}
