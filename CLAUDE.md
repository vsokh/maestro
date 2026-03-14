# CLAUDE.md

## What is this

Dev Manager is a standalone browser tool that pairs with Claude Code. It's a single HTML file (`index.html`) that managers use to create tasks, write instructions, and queue work. Claude Code's orchestrator skill reads the queue and executes.

## Architecture

Single self-contained `index.html` — no build step, no dependencies, no server. Opens in any browser.

- **React 19** via ESM imports from esm.sh
- **htm** tagged template literals (not JSX)
- **File System Access API** for reading/writing project files
- All inline styles, CSS custom properties in `:root`
- Font: Onest (Google Fonts)

## How it works

```
Dev Manager (browser)          Claude Code (terminal)
       |                              |
       |  .devmanager/state.json      |
       |  ◄────── write ──────►       |
       |   (500ms debounce)    (3s poll)
       |                              |
  Create tasks               /orchestrator next
  Write notes                  reads queue
  Queue work                   executes tasks
  See results                  writes back
```

### Project initialization

When user opens a project folder, Dev Manager:
1. Creates `.devmanager/state.json` if missing (empty project state)
2. Creates `.claude/skills/orchestrator/SKILL.md` if missing (generic orchestrator skill)
3. Never overwrites existing files

### State file: `.devmanager/state.json`

This is the single source of truth for the bidirectional sync.

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

### Orchestrator skill template

Embedded in `index.html` as `ORCHESTRATOR_SKILL_TEMPLATE` constant. Written to `.claude/skills/orchestrator/SKILL.md` on first project open. The template is generic — works with any project.

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

Uses the File System Access API (Chrome/Edge). The directory handle is persisted in IndexedDB (`devmanager_fs` database) so the project reconnects automatically on next visit (if permission is still granted).

Key functions:
- `ensureDevManagerDir(handle)` — creates `.devmanager/` in project
- `ensureOrchestratorSkill(handle)` — creates `.claude/skills/orchestrator/SKILL.md`
- `writeState(handle, data)` — writes `.devmanager/state.json`
- `readState(handle)` — reads `.devmanager/state.json` + lastModified timestamp

## Design

Warm palette matching TherapyDesk's aesthetic (can be themed later):
- Background: `#f5f0eb`
- Surface: `#fefcf9`
- Accent (tasks): `#6a8dbe`
- Amber (drafts): `#c4845a`
- Success (shipped): `#5a9e72`

Layout: 2x2 grid — `[TaskBoard | Detail]` over `[Queue | Activity]`

## Skill auto-suggest

`SKILL_KEYWORDS` array maps keywords in task title/description to Claude Code skills. When creating a task, skills are auto-detected (e.g. "fix auth bug" → `debugging`, `backend-development`). User can override.

## What NOT to do

- Don't add a build step — this must stay as a single HTML file
- Don't add a server — everything is client-side via File System Access API
- Don't embed project-specific data — all state comes from `.devmanager/state.json`
- Don't use HTML entities in htm templates — use actual Unicode characters
- Don't show implementation details to the manager (task IDs, commit hashes, skill names, spec file paths)
