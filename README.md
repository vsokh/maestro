# Dev Manager

Browser-based task manager that pairs with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Create tasks, write instructions, queue work — an orchestrator picks it up, plans the approach, delegates to sub-agents, and writes results back.

## Quick Start

**Prerequisites:** [Node.js](https://nodejs.org/) 18+, [Claude Code](https://docs.anthropic.com/en/docs/claude-code)

```bash
git clone https://github.com/vsokh/dev-manager.git && cd dev-manager && npm install && npm run build
```

```bash
npm start ./your-project
```

Opens at `http://localhost:4545`. Pass multiple project paths to manage several projects from one instance.

### Development

```bash
npm run dev            # Vite dev server (hot reload)
npm run dev:server     # Bridge server (file I/O + WebSocket)
```

## Usage

1. **Open project** — pick the folder you want to manage (your project, not this repo). Or pass it as an argument to `npm start`.

2. **Create tasks** — add work items on the board, write detailed instructions in the side panel. Group tasks into epics, add dependencies, attach files.

3. **Queue & launch** — queue a task, then hit the play button to launch Claude Code with the orchestrator skill loaded. Choose between terminal mode (opens a new tab) or headless mode (runs in the background with live output streaming).

4. **Watch it work** — the orchestrator reads your task, plans the approach, asks for approval, delegates to sub-agents, and writes results back. Dev Manager picks up changes via WebSocket in real time.

## Features

- **Task board** with statuses (pending, in-progress, paused, blocked, done), epics, dependencies, and attachments
- **Scratchpad** — dump ideas in plain text, then split them into structured tasks with one click (uses Claude to parse)
- **Command queue** with one-click launch into Claude Code — terminal or headless mode
- **Live output viewer** for headless processes with real-time streaming
- **Quality panel** — code health scores across 11 dimensions, trend sparklines, and radar chart
- **Activity feed** — tracks what happened and when, click to jump to the relevant task
- **Multi-project support** — manage multiple projects from a single instance
- **Dark mode** with warm neutral palette
- **Git integration** — see branch, unpushed commits, push from the UI
- **Skill deployment** — auto-installs orchestrator and other Claude Code skills into your project

## One-Click Launch Setup (one-time)

The play buttons can open a named terminal tab via the `claudecode://` protocol.

**Windows:** run `install-protocol.cmd`
**Linux:** `chmod +x install-protocol.sh && ./install-protocol.sh`

## Architecture

**Frontend:** Vite + React 19 + TypeScript. Inline styles with CSS custom properties.
**Backend:** Node.js bridge server — HTTP API, WebSocket for live updates, file watcher for `.maestro/` changes.

```
src/                          server/
├── App.tsx                   ├── index.js      # HTTP + WebSocket server
├── api.ts                    ├── api.js        # REST endpoints
├── fs.ts                     ├── watcher.js    # File system watcher
├── skills.ts                 └── process.js    # Headless process manager
├── orchestrator.ts
├── hooks/
│   ├── useProject.ts
│   ├── useTaskActions.ts
│   ├── useQueueActions.ts
│   ├── useQuality.ts
│   ├── useProcessOutput.ts
│   └── ...
└── components/
    ├── TaskBoard.tsx         # Task cards with epics and status filters
    ├── TaskDetail.tsx        # Side panel: notes, deps, attachments, flags
    ├── CommandQueue.tsx      # Queue with launch buttons + output viewer
    ├── QualityPanel.tsx      # Code health scores + charts
    ├── ActivityFeed.tsx      # Recent events log
    ├── Scratchpad.tsx        # Floating notepad with AI task splitting
    ├── Header.tsx            # Project name, sync status, theme toggle
    └── ProjectPicker.tsx     # Landing screen + project templates
```

### State file: `.maestro/state.json`

Single source of truth for the bidirectional sync between Dev Manager and Claude Code.

## How It Works

```
  You (Dev Manager)            Orchestrator (Claude Code)          Sub-agents
       |                              |                              |
  Create tasks                        |                              |
  Write notes ─── state.json ───►     |                              |
  Queue work                          |                              |
       |                              |                              |
       |          ▶ Launch (terminal or headless)                    |
       |                              |                              |
       |                     Read queue + notes                      |
       |                     Plan approach ──► you approve           |
       |                     Delegate ──────────────────────────►  work
       |                     Review  ◄──────────────────────────   done
       |                     Write back ──► state.json               |
       |                              |                              |
  See results ◄── WebSocket push      |                              |
```

## License

MIT
