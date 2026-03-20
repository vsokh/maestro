# Dev Manager

A browser-based task manager that pairs with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). You create tasks and queue work in the browser — Claude Code's orchestrator picks them up, plans the approach, and delegates to sub-agents to get the work done.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and working
- Chrome or Edge (requires File System Access API)
- Windows Terminal (for one-click launch)

## Setup

### 1. Install and run

```bash
git clone <repo-url>
cd dev-manager
npm install
npm run dev
```

Open the URL shown in your terminal (usually `http://localhost:5173`) in **Chrome or Edge**.

### 2. Connect a project

Dev Manager doesn't manage its own code — it manages **your other projects**. You need to point it at a project folder.

- Click **Open project** on the landing screen.
- In the folder picker, navigate to the **root folder of the project** you want to manage (e.g. your app's repo).
- Your browser will ask you to grant read/write access — click **Allow**.

Dev Manager creates a `.devmanager/` folder inside that project to store tasks, notes, and state. The connection is remembered — next time you open Dev Manager it reconnects automatically.

### 3. Create tasks

Use the task form on the left to add work items. Give each task a clear name and optional description.

### 4. Write notes

Click a task to open the detail panel on the right. Write instructions here — these notes tell Claude Code exactly what you want done.

### 5. Queue work

Hit the **queue button** on a task to add it to the work queue at the bottom. Queued tasks are what the orchestrator picks up.

### 6. Register the launch protocol (Windows, one-time)

The play buttons next to queued tasks need a way to open Claude Code from the browser. This step registers a `claudecode://` URL protocol on your machine — similar to how `mailto:` links open your email client.

```bash
install-protocol.cmd
```

No admin required. You only need to do this once.

### 7. Set your project path

In the queue panel, set the path to your project folder (e.g. `C:\Users\you\Projects\my-app`). This is stored per project in your browser.

### 8. Launch

Click the **play button** next to a queued task. Claude Code opens in a new terminal tab with the orchestrator skill loaded and your task ready to go.

The orchestrator will read your task and notes, explore the codebase, and present a plan. You approve it, and it delegates the work to sub-agents. When it's done, it writes results back — Dev Manager picks up the changes automatically (polls every 3 seconds).

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
