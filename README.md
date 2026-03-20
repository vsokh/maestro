# Dev Manager

A browser-based task manager that pairs with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). You create tasks and queue work in the browser — Claude Code's orchestrator picks them up, plans the approach, and delegates to sub-agents to get the work done.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and working
- Chrome or Edge (requires File System Access API)
- Windows Terminal (for one-click launch)

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url>
cd dev-manager

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open **http://localhost:5173** in Chrome or Edge.

## Connect a Project

1. Click **Open project** and select any folder that has a codebase you want to manage.
2. Dev Manager creates a `.devmanager/` folder inside that project to store tasks and state.
3. The connection is remembered — next time you open Dev Manager it reconnects automatically.

## Using It

### Create Tasks
Use the task form to add work items. Give each task a clear name and optional description.

### Write Notes
Select a task and write instructions in the detail panel. These notes tell Claude Code exactly what you want done.

### Queue Work
Hit the queue button on a task to add it to the work queue. Queued tasks are what the orchestrator picks up.

### Launch Claude Code
Each queued task has a **play button** that opens Claude Code in a new terminal tab, pre-loaded with the orchestrator skill and your task. Before first use, you need to set up the protocol handler (see below).

### See Results
Dev Manager polls for changes every 3 seconds. When Claude Code finishes work and writes results back, you'll see updates automatically.

## One-Click Launch Setup (Windows)

This registers a `claudecode://` URL protocol so the play buttons can open Claude Code directly.

```bash
# Run once — no admin required
install-protocol.cmd
```

After this, set your project path in the queue panel (stored per project in your browser).

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests (watch mode) |
| `npm run test:run` | Run tests once |
| `npm run lint` | Check for lint errors |
| `npm run lint:fix` | Auto-fix lint errors |

## How It Works

```
You (Browser)                   Orchestrator (Claude Code)           Sub-agents
     |                                    |                              |
 Create tasks                             |                              |
 Write notes ──► .devmanager/state.json ─►|                              |
 Queue work                               |                              |
     |                          ▶ Launch via play button                  |
     |                                    |                              |
     |                           Read queue + notes                      |
     |                           Plan approach ──► you approve           |
     |                           Delegate ───────────────────────► work
     |                           Review ◄────────────────────────── done
     |                           Write back ──► state.json               |
     |                                    |                              |
 See results ◄── auto-sync                |                              |
```

## Tech Stack

- React 19 + Vite
- No backend — fully client-side via the File System Access API
- All state lives in `.devmanager/state.json` inside your project

## License

MIT
