# CLAUDE.md

## What is this

Dev Manager is a browser-based task orchestrator that pairs with AI agents (Claude Code, Codex, Cursor). A manager creates tasks, sets dependencies, writes instructions, and queues work. AI agents pick up tasks, execute in isolated git worktrees, and report back through progress files.

## Architecture — Onion

```
Layer 3: Infrastructure (this repo's server/ and src/)
  server/*.js          — Node.js HTTP + WebSocket, implements ports
  src/hooks/*.ts       — React state wrappers
  server/index.js      — composition root

Layer 2: Application Services (packages/)
  packages/agent-runner/     — AI process lifecycle (spawn, stream, buffer, kill)
  packages/sync-protocol/    — state sync (debounce, version guards, conflict resolution)

Layer 1: Domain (packages/)
  packages/taskgraph/        — pure state machine (queue sort, task CRUD, progress merge)
```

Dependencies point inward only. Packages define port interfaces — the server implements them with real I/O.

## Commands

```bash
npm run dev          # Vite dev server (http://localhost:5173), proxies API to bridge
npm run dev:server   # bridge server (http://localhost:4545)
npm run build        # Vite production build
npm start ./path     # CLI: start bridge server for a project directory

npm run lint         # ESLint on src/
npm run test:run     # vitest single run
npm test             # vitest watch mode
```

Development requires running both `npm run dev` and `npm run dev:server` simultaneously. Vite proxies `/api` and `/ws` to the bridge server.

## Packages

### taskgraph (`packages/taskgraph/`)
Pure functions, zero deps. State in, new state out.
- Queue: `sortByDependencies`, `computePhases`, `addToQueue`, `removeFromQueue`
- Tasks: `addTask`, `updateTask`, `deleteTask`, `renameGroup`, `deleteGroup`
- State: `mergeProgressIntoState`, `protectDoneTaskRegression`, `validateState`, `incrementVersion`
- CLI scripts: `queue-next`, `task-start`, `task-done`, `merge-safe` (bundled to CJS via esbuild)

### agent-runner (`packages/agent-runner/`)
Process lifecycle through injected ports (`SpawnPort`, `BroadcastPort`, `ProgressWriterPort`).
- `ProcessManager`: spawn, stream output (500-line buffer), kill, fallback progress on crash
- `buildClaudePrompt`: translates `/orchestrator task N` to full LLM prompts
- `DEFAULT_ENGINES`: adapters for claude, codex, cursor

### sync-protocol (`packages/sync-protocol/`)
Bidirectional sync through injected ports (`FileReaderPort`, `FileWriterPort`, `FileWatcherPort`, `StatePersistencePort`, `TimerPort`).
- `WatcherOrchestrator`: debounce, content dedup, version guards (server-side)
- `StateWriter`: optimistic locking, conflict detection, version increment (server-side)
- `SyncEngine`: debounced save, conflict resolution, progress merge (client-side, framework-agnostic)

## Frontend (`src/`)

- `App.tsx` — root component, composes all hooks and panels
- `api.ts` — HTTP/WebSocket client for bridge server
- `hooks/` — useProject, useTaskActions, useQueueActions, useSync (thin wrapper around SyncEngine), useErrors, useProcessOutput, useQuality, useRelease
- `components/` — TaskBoard, TaskDetail, CommandQueue, ActivityFeed, QualityPanel, ErrorsPanel, ReleasePanel
- `types/index.ts` — re-exports core types from taskgraph + product-only types (Quality, Errors, Release, WebSocket)

## Backend (`server/`)

Node.js HTTP + WebSocket server on port 4545. Thin adapters implementing package ports.

- `index.js` — composition root (wires ports, starts server)
- `process.js` — implements `SpawnPort` + `ProgressWriterPort` via node:child_process + node:fs
- `watcher.js` — implements `FileWatcherPort` via node:fs.watch, deploys CLI scripts
- `routes/state.js` — uses `StateWriter` from sync-protocol for optimistic locking
- `routes/launch.js` — HTTP interface to `ProcessManager` from agent-runner
- `routes/` — also: projects, git, skills, quality, errors, release, attachments, backups

## State file: `.maestro/state.json`

Single source of truth. Bridge server watches it and pushes changes via WebSocket. Writes use optimistic locking (`_lastModified` + `_v` version counter).

## Orchestrator skill

Template in `src/orchestrator.ts`. Auto-deployed to `.claude/skills/orchestrator/SKILL.md` on project connect.

The orchestrator reads the queue, explores the codebase, plans, gets user approval, delegates to sub-agents in git worktrees, reviews, and merges back to master.

**CRITICAL:** Agents write to `.maestro/progress/{taskId}.json`, NEVER to `state.json` directly. The UI merges progress files into state automatically.

## CI

GitHub Actions: lint, typecheck, test (all packages + product), build.

## Protected files

Do NOT modify these unless explicitly asked:
- `src/orchestrator.ts` — skill template deployed to every project
- `src/codehealth.ts` — code quality scanner template
- `src/autofix.ts` — auto-fix skill template
- `src/release.ts` — release management template
- `src/errortracker.ts` — error tracker skill template (if exists)
