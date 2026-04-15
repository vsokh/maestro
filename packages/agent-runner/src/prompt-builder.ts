import type { EngineAdapter } from './types.js';

/**
 * Translates slash commands into full LLM prompts for headless execution.
 * Pure function — no I/O.
 */
export function buildClaudePrompt(command: string): string {
  const taskMatch = command.match(/^\/orchestrator\s+task\s+(\d+)/);
  if (taskMatch) {
    const taskId = taskMatch[1];
    return `Read .devmanager/state.json, find task #${taskId}, and execute it using the orchestrator skill defined in .claude/skills/orchestrator/SKILL.md. This is a headless execution — skip plan approval, execute the full plan immediately. Do not wait for user input at any point.

CRITICAL — DO NOT WRITE TO .devmanager/state.json DIRECTLY. Other agents and the UI write to state.json concurrently. If you overwrite it, you will destroy other agents' work. Instead:

1. Write progress updates ONLY to .devmanager/progress/${taskId}.json (the UI merges these automatically)
2. For progress during execution, write to .devmanager/progress/${taskId}.json with:
   {"status":"in-progress","progress":"<current step>"}
3. When done, use the helper script: node .devmanager/bin/task-done.cjs ${taskId} --commit <short-hash>
   This writes the final done status to the progress file (the UI handles queue removal and activity logging)

When the task is complete, write the progress file to .devmanager/progress/${taskId}.json with this format:
{"status":"done","completedAt":"<ISO date>","commitRef":"<short hash>","summary":"<2-3 sentence product-level summary of what was done and what users will see>","filesChanged":<number>}

The summary should be written for a product manager — describe the user-facing outcome, not the code changes.`;
  }

  if (/^\/codehealth/.test(command)) {
    return `Execute the codehealth skill defined in .claude/skills/codehealth/SKILL.md. Scan the entire codebase, score all 11 dimensions, and write the results to .devmanager/quality/latest.json.

This is a headless execution — do not wait for user input at any point.`;
  }

  if (/^\/autofix/.test(command)) {
    return `Execute the autofix skill defined in .claude/skills/autofix/SKILL.md. Read the codehealth backlog from .devmanager/quality/backlog.json, pick the highest-priority fixable issues, and fix them.

Write progress updates to .devmanager/progress/autofix.json as you work.

This is a headless execution — do not wait for user input at any point.`;
  }

  if (/^\/orchestrator\s+arrange/.test(command)) {
    return `Read .devmanager/state.json and analyze all pending tasks. Organize them into a logical dependency graph — figure out which tasks depend on others and set the dependsOn fields. Group related tasks under epics.

CRITICAL — DO NOT WRITE TO .devmanager/state.json DIRECTLY. Other agents and the UI write to state.json concurrently. If you overwrite it, you will destroy other agents' work.

Instead, write ALL your changes to .devmanager/progress/arrange.json. The UI merges this automatically. Use this exact JSON format:
{"status":"done","label":"<short summary of changes>","changes":[<list of change descriptions>],"taskUpdates":{"<taskId>":{"dependsOn":[<ids>],"group":"<epic name>"}}}

The taskUpdates object maps task IDs to the fields you want to change. Only include dependsOn and group fields.

Example: {"status":"done","label":"Arranged 8 tasks into 3 phases","changes":["Set task #5 depends on #3","Grouped #6,#7,#8 under 'Polish' epic"],"taskUpdates":{"5":{"dependsOn":[3],"group":"Core"},"6":{"group":"Polish"},"7":{"group":"Polish"},"8":{"group":"Polish"}}}

Be specific about what dependencies you set and what groupings you made.`;
  }

  return command + '\n\nThis is a headless execution. Skip plan approval and execute immediately. Do not wait for user input at any point.';
}

/**
 * Default engine adapters. Maps engine name to spawn command + args.
 */
export const DEFAULT_ENGINES: Record<string, EngineAdapter> = {
  claude: (command: string, model?: string) => ({
    cmd: 'claude',
    args: [
      ...(model ? ['--model', model] : []),
      '--dangerously-skip-permissions',
      '-p',
      buildClaudePrompt(command),
    ],
  }),
  codex: (command: string) => ({
    cmd: 'codex',
    args: ['exec', command],
  }),
  cursor: (command: string) => ({
    cmd: 'cursor-agent',
    args: ['-p', command],
  }),
};
