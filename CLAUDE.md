# CLAUDE.md

## What is this

Dev Manager is a standalone browser tool that pairs with Claude Code. A manager uses it to create tasks, write instructions, and queue work. Claude Code's orchestrator skill acts as a tech lead — reads the queue, plans the approach, delegates to sub-agents, reviews results, and writes back.

## Two hats

The user wears two hats:
- **Manager hat** (Dev Manager in browser): creates tasks, writes notes, prioritizes, queues work. Product-level thinking.
- **Developer hat** (Claude Code in terminal): reviews orchestrator's plans, approves delegation, helps navigate tricky implementation. Technical-level thinking.

The orchestrator is the bridge. It reads manager intent and translates it into technical execution.

## Architecture

Single self-contained `index.html` — no build step, no dependencies, no server.

- **React 19** via ESM imports from esm.sh
- **htm** tagged template literals (not JSX)
- **File System Access API** for reading/writing project files
- All inline styles, CSS custom properties in `:root`
- Font: Onest (Google Fonts)

## How it works

```
Manager (Dev Manager)              Tech Lead (Orchestrator)              Developers (Sub-agents)
       |                                    |                                    |
  Create tasks                              |                                    |
  Write notes ──► .devmanager/state.json ──►|                                    |
  Queue work                                |                                    |
       |                           /orchestrator next                            |
       |                                    |                                    |
       |                           1. Read queue + notes                         |
       |                           2. Explore codebase (Agent)                   |
       |                           3. Present plan ──► user approves             |
       |                           4. Delegate ─────────────────────────► implement
       |                           5. Review result ◄───────────────────── done
       |                           6. Write back ──► state.json                  |
       |                                    |                                    |
  See results ◄── auto-sync (3s poll)       |                                    |
```

## Project initialization

When user opens a project folder, Dev Manager:
1. Creates `.devmanager/state.json` if missing (empty project state)
2. Creates `.claude/skills/orchestrator/SKILL.md` if missing (tech lead skill)
3. Never overwrites existing files

## State file: `.devmanager/state.json`

Single source of truth for the bidirectional sync.

```json
{
  "project": "my-project",
  "tasks": [{ "id": 1, "name": "...", "fullName": "...", "status": "pending|done|blocked" }],
  "features": [{ "id": "...", "name": "...", "description": "..." }],
  "drafts": [{ "id": "card_123", "title": "...", "description": "...", "skills": [] }],
  "queue": [
    { "task": 1, "taskName": "...", "notes": "..." },
    { "action": "promote-and-execute", "cardId": "card_123", "taskName": "...", "description": "...", "skills": [], "notes": "..." }
  ],
  "taskNotes": { "1": "manager instructions..." },
  "draftNotes": { "card_123": "extra context..." },
  "activity": [{ "id": "act_123", "time": 1234567890, "label": "..." }],
  "sessions": [{ "id": "sess_1", "timestamp": "ISO-8601", "taskName": "...", "status": "completed", "summary": "..." }]
}
```

## Orchestrator skill (tech lead)

Embedded in `index.html` as `ORCHESTRATOR_SKILL_TEMPLATE`. Auto-installed to `.claude/skills/orchestrator/SKILL.md` on first project open.

The orchestrator:
1. **Reads** the queue and manager notes from `.devmanager/state.json`
2. **Explores** the codebase with Explore sub-agents to understand context
3. **Plans** the technical approach and presents it to the user
4. **Waits** for user approval — NEVER auto-delegates
5. **Delegates** to implementation sub-agents via the Agent tool
6. **Reviews** the sub-agent's output (build passed? requirements met?)
7. **Writes back** results to `.devmanager/state.json` so Dev Manager auto-syncs

## Key components

| Component | Purpose |
|-----------|---------|
| `useProject()` | Hook: connect/disconnect project folder, auto-save, poll for external changes |
| `ProjectPicker` | Landing screen: "Open project" button + last project shortcut |
| `Header` | Project name + sync status |
| `TaskBoard` | Pending task cards + draft cards + "Add task" + collapsible shipped features |
| `TaskDetail` | Detail panel for selected task/draft: status, name, notes, queue button |
| `CardForm` | New task form with skill auto-suggest from keywords |
| `CommandQueue` | Queue list + `/orchestrator next` copy button |
| `ActivityFeed` | Recent actions from sessions + local activity |

## File system access

Uses the File System Access API (Chrome/Edge). The directory handle is persisted in IndexedDB (`devmanager_fs` database) so the project reconnects automatically on next visit.

Key functions:
- `ensureDevManagerDir(handle)` — creates `.devmanager/` in project
- `ensureOrchestratorSkill(handle)` — creates `.claude/skills/orchestrator/SKILL.md`
- `writeState(handle, data)` — writes `.devmanager/state.json`
- `readState(handle)` — reads `.devmanager/state.json` + lastModified timestamp

## Design

Warm neutral palette:
- Background: `#f5f0eb`
- Surface: `#fefcf9`
- Accent (tasks): `#6a8dbe`
- Amber (drafts): `#c4845a`
- Success (shipped): `#5a9e72`

Layout: 2x2 grid — `[TaskBoard | Detail]` over `[Queue | Activity]`

## What NOT to do

- Don't add a build step — single HTML file, always
- Don't add a server — client-side only via File System Access API
- Don't embed project-specific data — all state comes from `.devmanager/state.json`
- Don't use HTML entities in htm templates — use actual Unicode characters
- Don't show implementation details to the manager (commit hashes, skill names, spec file paths, task IDs)
- Don't let the orchestrator auto-execute without user approval
