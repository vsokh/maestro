---
name: orchestrator
description: "Project workflow coordinator. Reads queue from Dev Manager, executes tasks, creates specs, writes back results. TRIGGER on: orchestrator, what's next, plan work, project status, execute queue."
---

# Orchestrator — Project Workflow Coordinator

You coordinate development work between the Dev Manager (browser dashboard) and Claude Code. The manager creates tasks and queues work in the Dev Manager. You execute it here.

## State file

All project state lives in `.devmanager/state.json`. The Dev Manager writes to it (500ms debounce), you read from it and write back (Dev Manager polls every 3s, auto-syncs).

```json
{
  "project": "ProjectName",
  "tasks": [{ "id": 1, "name": "...", "fullName": "...", "status": "pending" }],
  "features": [{ "id": "...", "name": "...", "description": "..." }],
  "drafts": [{ "id": "card_123", "title": "...", "description": "...", "skills": [] }],
  "queue": [],
  "taskNotes": { "1": "manager's instructions..." },
  "draftNotes": { "card_123": "extra context..." },
  "activity": [],
  "sessions": []
}
```

## Invocation modes

- **`/orchestrator`** or **`/orchestrator status`** — Project status overview
- **`/orchestrator next`** — Execute next queued item (primary workflow)
- **`/orchestrator task N`** — Plan/execute a specific task
- **`/orchestrator plan`** — Plan remaining work
- **`/orchestrator history`** — Session timeline

---

## Mode: `/orchestrator next` (primary)

This is the main command. The manager queues work in Dev Manager, you execute it here.

1. Read `.devmanager/state.json`
2. If file doesn't exist: "No Dev Manager state found. Open Dev Manager and connect this project folder."
3. Pick the first item from `queue`
4. Handle by type:

### A) Existing task: `{ "task": N, "taskName": "...", "notes": "..." }`
1. Read the spec at `specs/tasks/{NN}-*.md` if it exists
2. Read `notes` — these are the manager's instructions (HIGH PRIORITY — follow them)
3. Also check `taskNotes[N]` for additional context
4. Present the execution plan and wait for approval
5. After execution: update `.devmanager/state.json`:
   - Remove item from `queue`
   - Update task status in `tasks` array (set `status: "done"`, `completedAt: "YYYY-MM-DD"`)
   - Add entry to `activity` array
   - Add entry to `sessions` array

### B) New task (draft): `{ "action": "promote-and-execute", "cardId": "...", "taskName": "...", "description": "...", "skills": [...], "notes": "..." }`
1. **Promote to formal task:**
   - Assign next ID (max existing task ID + 1)
   - Create spec file at `specs/tasks/{NN}-{slug}.md` with title, description, manager notes, skills
   - Add to `tasks` array in state.json with `status: "pending"`
2. **Execute** using the spec + manager notes
3. After execution: update `.devmanager/state.json`:
   - Remove from `queue`
   - Remove matching draft from `drafts` array
   - Update task status if completed
   - Add to `activity` and `sessions`

### If queue is empty
Check `drafts` array. If any exist, list them and ask which to work on. If empty: "Nothing queued. Add tasks in Dev Manager."

---

## Mode: `/orchestrator status`

1. Read `.devmanager/state.json`
2. Read git log (`git log --oneline -10`) for recent commits
3. Output a status summary:

```
## {project} — Status

Pending: {count} tasks
- Task name 1
- Task name 2

Shipped features: {count}
- Feature 1: description
- Feature 2: description

Queue: {count} items waiting
```

---

## Mode: `/orchestrator task N`

1. Read `.devmanager/state.json` for manager context:
   - `taskNotes[N]` — manager's notes (HIGH PRIORITY)
   - `queue` — whether this was explicitly queued
2. Read the task spec at `specs/tasks/{NN}-*.md` if it exists
3. Present an execution plan:

```
## Execution Plan — {name}

### Manager notes
{paste notes — this is what the manager wants, follow it}

### Approach
{combine spec approach with manager notes — notes win on conflicts}

### Estimated scope
{files to modify} files, {complexity}
```

**Do NOT auto-execute.** Present the plan and wait for approval.

---

## Mode: `/orchestrator plan`

1. Read `.devmanager/state.json` — get pending tasks and drafts
2. For each: identify scope, estimate complexity
3. Output a sequenced plan with execution order

---

## Mode: `/orchestrator history`

1. Read `.devmanager/state.json` → `sessions` array
2. Format as timeline, newest first

---

## Write-back protocol

**After every operation**, write updates back to `.devmanager/state.json`:

1. Read the current file
2. Merge your updates (preserve manager's notes and unrelated fields)
3. Write back

The Dev Manager polls every 3s — it will auto-refresh and show "Synced from Claude!"

### What to update:
- `tasks` — update status, add new tasks from promoted drafts
- `queue` — remove executed items
- `drafts` — remove promoted drafts
- `activity` — append new entries: `{ "id": "act_{timestamp}", "time": {ms}, "label": "..." }`
- `sessions` — append completion records
- `features` — add new feature groups when work ships

---

## Spec file format

When promoting a draft, create a spec at `specs/tasks/{NN}-{slug}.md`:

```markdown
# Task {N}: {title}

> {description from manager}

## Manager notes

{notes from taskNotes or draftNotes}

## Approach

[Orchestrator fills this based on codebase analysis]

## Files to modify

- [identified files]

## Acceptance criteria

- [ ] [derived from description and notes]
```

---

## Data files

| File | Purpose |
|------|---------|
| `.devmanager/state.json` | Bidirectional sync with Dev Manager |
| `specs/tasks/*.md` | Task specs (created by orchestrator for new tasks) |
