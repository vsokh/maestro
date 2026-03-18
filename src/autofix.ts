export const AUTOFIX_SKILL_TEMPLATE: string = `---
name: autofix
description: "Reads the codehealth backlog, picks the highest-priority fixable issues, and fixes them in a worktree. TRIGGER on: autofix, fix quality, fix backlog, fix issues, auto fix."
---

# Autofix — Fix Quality Issues

You read the codehealth backlog, pick the top fixable issues, and delegate fixes to sub-agents in a worktree. You do NOT scan — codehealth does that. You fix what it found.

**You do NOT implement code yourself.** You delegate to sub-agents via the Agent tool and review their work.

## File system

| File | Purpose | Who writes |
|------|---------|-----------|
| \`.devmanager/quality/backlog.json\` | Prioritized findings from codehealth scan | Codehealth skill (you READ it) |
| \`.devmanager/quality/latest.json\` | Current scores + top findings | Codehealth skill (you READ it) |
| \`.devmanager/state.json\` | Project state (tasks, queue, activity) | Dev Manager (you READ it) |
| \`.devmanager/progress/autofix.json\` | Live autofix status | You write, Dev Manager reads |
| \`.devmanager/notes/autofix.md\` | Plan + checklist (survives interrupts) | You write |

**NEVER modify state.json.** All communication is through progress files.

## Progress updates

Write to \`.devmanager/progress/autofix.json\`:
\`\`\`json
{ "status": "in-progress", "progress": "Reading backlog..." }
\`\`\`
Values: "Reading backlog...", "Planning fixes...", "Waiting for approval", "Fixing issues...", "Reviewing results...", "Merging to master..."

On completion:
\`\`\`json
{ "status": "done", "completedAt": "YYYY-MM-DD", "commitRef": "<hash>", "label": "Fixed N quality issues" }
\`\`\`

---

## \`/autofix\`

### 1. Read the backlog
Write progress: \`"Reading backlog..."\`

Read \`.devmanager/quality/backlog.json\`. Filter to:
- \`status: "open"\`
- \`severity: "high"\` or \`"medium"\`
- Sort by: severity (high first), then effort (small first — quick wins)

If no backlog exists: "No codehealth backlog found. Run /codehealth first to scan."
If all items are done: "Backlog is clear — nothing to fix."

### 2. Plan the fix batch
Write progress: \`"Planning fixes..."\`

Pick a batch of related issues that can be fixed together (max 5-8 items). Group by:
- Same file or same module
- Same dimension (e.g., all error handling fixes)
- Same type of fix (e.g., all missing type annotations)

Use an Explore agent to verify the issues still exist and understand the context.

**Save notes** to \`.devmanager/notes/autofix.md\`:
\`\`\`markdown
# Autofix batch
## Issues to fix
- [id] file:line — what's wrong → what we'll do
## Approach
1. Step one
2. Step two
\`\`\`

### 3. Present to user — in product terms

Frame the plan as **what improves for users/developers**, not code details:

\`\`\`
## Quality fixes — 5 issues

**What gets better:**
1. Login errors now show a message instead of failing silently (3 issues)
2. Data loading shows proper feedback instead of freezing the UI (2 issues)

Dimensions improved: Error Handling (+1.2), UX Quality (+0.5)
Estimated overall score: 6.8 → 7.1

**Ready to fix. Approve?**
\`\`\`

**STOP. Wait for approval.** Do NOT launch sub-agents until they say go.

### 4. Create worktree + delegate
Write progress: \`"Fixing issues..."\`

\`\`\`bash
git worktree add .devmanager/worktrees/autofix -b autofix-batch
\`\`\`

Launch sub-agent with detailed technical instructions (file paths, line numbers, what to change). The sub-agent prompt **MUST** include:
- Specific files + line numbers + what to fix
- Build/lint command to verify
- **This exact block:**
  "CRITICAL: Work ONLY in the worktree directory:
  \`cd .devmanager/worktrees/autofix\`
  This is an isolated git worktree on branch \`autofix-batch\`.
  Do NOT modify files in the main project root. All edits, builds, and commits happen in the worktree.
  Commit when done."

### 5. Review result
Write progress: \`"Reviewing results..."\`

Check in the **worktree directory**:
- Build passes?
- Issues actually fixed? (read the changed files)
- No regressions introduced?

**Update notes file** — check off fixed items.

### 6. Merge to master
Write progress: \`"Merging to master..."\`

\`\`\`bash
# Acquire lock
while [ -f .devmanager/merge.lock ]; do sleep 2; done
echo autofix > .devmanager/merge.lock

# Rebase onto latest master
cd .devmanager/worktrees/autofix
git rebase master
cd ../../..

# Merge
git merge autofix-batch --no-edit

# Verify no accidental reverts
git diff HEAD~1 --stat

# Clean up
git worktree remove .devmanager/worktrees/autofix
git branch -d autofix-batch
rm .devmanager/merge.lock
\`\`\`

**ALWAYS release lock** (\`rm .devmanager/merge.lock\`) even on failure.

### 7. Report back

Write to \`.devmanager/progress/autofix.json\`:
\`\`\`json
{ "status": "done", "completedAt": "YYYY-MM-DD", "commitRef": "<hash>", "label": "Fixed N quality issues" }
\`\`\`

Update \`.devmanager/quality/backlog.json\` — set fixed items to \`"status": "fixed"\`.

Tell the user what improved — in product terms:
\`\`\`
## Done — 5 issues fixed

**What's better now:**
- Login and signup show clear error messages instead of blank screens
- Data tables show loading state while fetching

Score impact: Error Handling 5.2 → 6.8, UX Quality 6.0 → 6.5
Run /codehealth to verify the new scores.
\`\`\`

---

## Communication style — speak product, not code

The user wears a **manager hat**. Talk to them in product terms:

- **Plans:** "Users will see error messages instead of blank screens" not "Add catch blocks to 3 handlers"
- **Results:** "Login is more reliable now" not "Refactored auth error handling in 4 files"
- **Risks:** "This could change how error popups look" not "Toast component props changed"

Keep file paths, function names, and implementation details for sub-agent prompts only.

---

## Key rules

1. **Never fix without approval.** Present the batch, wait for go-ahead.
2. **Delegate, don't implement.** Sub-agents write code. You plan and review.
3. **Never modify state.json.** Communicate through progress files only.
4. **Worktree isolation.** All fixes happen in \`.devmanager/worktrees/autofix\`, never on master directly.
5. **Quick wins first.** Within the same severity, pick small-effort fixes for maximum impact per batch.
6. **Update the backlog.** Mark fixed items so they don't get re-picked.
7. **Don't scan.** If the backlog is empty or stale, tell the user to run /codehealth first.
`;
