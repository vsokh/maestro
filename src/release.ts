export const RELEASE_SKILL_TEMPLATE: string = `---
name: release
description: "Release management with versioning, stability assessment, changelog generation, and release gates. TRIGGER on: release, version, changelog, tag, cut release, release status, what version, stability, release gate."
---

# Release — Version & Changelog Management

You manage releases: assess stability, generate changelogs, check release gates, cut versions with tags, and classify legacy commits. You do NOT implement code — you read project state and git history to make release decisions.

## File system

| File | Purpose | Who writes |
|------|---------|-----------|
| \`.devmanager/quality/latest.json\` | Current codehealth scores + baseline | Codehealth skill (you READ) |
| \`.devmanager/quality/backlog.json\` | Prioritized findings | Codehealth skill (you READ) |
| \`.devmanager/quality/history.json\` | Score history over time | Codehealth skill (you READ + annotate) |
| \`.devmanager/release/releases.json\` | Release history metadata | You write |
| \`.devmanager/release/legacy-commits.json\` | Legacy commit type classifications | You write (retroactive only) |
| \`.devmanager/release/stability.json\` | Cached stability assessment | You write |
| \`.devmanager/progress/release.json\` | Dev Manager activity signal | You write |
| \`CHANGELOG.md\` | Project changelog (Keep a Changelog format) | You write |
| \`package.json\` | Version field | You update (version only) |

**NEVER modify state.json.** All communication is through progress files.

---

## Semver rules (pre-1.0)

| Bump | When |
|------|------|
| Minor 0.x.0 | New user-facing features, architectural milestones |
| Patch 0.x.y | Bug fixes, quality improvements, refactoring, tests |

Breaking changes noted in changelog but don't trigger major bump until 1.0.

## Conventional commit format

All new commits should use: \`type(scope): description\`

| Type | Changelog section |
|------|------------------|
| feat | Added |
| fix | Fixed |
| refactor | Changed |
| test | Infrastructure |
| style | Changed |
| perf | Changed |
| a11y | Accessibility |
| security | Security |
| docs | Infrastructure |
| chore | Infrastructure |

---

## \\\`/release status\\\`

Show stability score, what's in the next release, and any blockers.

### Steps

1. **Get current version**: read \`package.json\` \`version\` field
2. **Find last tag**: \`git describe --tags --abbrev=0 2>/dev/null\` (if no tags, use initial commit)
3. **Count commits since tag**: \`git rev-list {lastTag}..HEAD --count\`
4. **List commits since tag**: \`git log {lastTag}..HEAD --oneline\`
5. **Run stability assessment** (see algorithm below)
6. **Check release gates** (see gates below)
7. **Write results** to \`.devmanager/release/stability.json\`:
   \\\`\\\`\\\`json
   {
     "score": 72,
     "level": "Release Candidate",
     "components": {
       "buildTest": 85,
       "codehealth": 63,
       "fixRatio": 80,
       "backlog": 60,
       "regression": 60,
       "fixDecay": 80
     },
     "gateResults": {
       "Build": "pass",
       "Tests": "pass",
       "Codehealth": "warn",
       "Regressions": "fail",
       "Backlog": "fail",
       "Lint": "pass"
     },
     "assessedAt": "YYYY-MM-DD",
     "commitRef": "{HEAD hash}",
     "currentVersion": "v{version}",
     "commitsSinceRelease": {count}
   }
   \\\`\\\`\\\`

### Output format

\\\`\\\`\\\`
## Release Status

Current version: v{version}
Commits since last release: {count}
Stability: {score}/100 — {level}

### What's in the next release
- {commit summary grouped by type}

### Gate status
{gate results: ✅ PASS / ⚠️ WARN / ❌ FAIL for each}

### Recommendation
{based on stability level and gates}
\\\`\\\`\\\`

---

## \\\`/release changelog\\\`

Preview changelog since last tag. Do NOT write to file.

### Steps

1. Find last tag: \`git describe --tags --abbrev=0 2>/dev/null\`
2. Get commits since tag: \`git log {lastTag}..HEAD --format="%H %s"\`
3. Classify each commit by type (parse conventional commit prefix, or infer from message)
4. Group into changelog sections: Added, Fixed, Changed, Security, Accessibility, Infrastructure
5. Output preview in Keep a Changelog format

### Output format

\\\`\\\`\\\`markdown
## [Unreleased] — {date}

### Added
- {feat commits}

### Fixed
- {fix commits}

### Changed
- {refactor, style, perf commits}

### Security
- {security commits}

### Accessibility
- {a11y commits}

### Infrastructure
- {test, docs, chore commits}
\\\`\\\`\\\`

Omit empty sections. Each entry: one line, user-facing language, no commit hashes.

---

## \\\`/release cut [major|minor|patch]\\\`

Full release flow: gates → bump → changelog → commit → tag → activity signal.

### Steps

1. **Run all gates** (see gate definitions). Show results.
   - Any ❌ FAIL = blocked. Tell user what failed and suggest fixes. Offer \`--force\` override.
   - ⚠️ WARN = allowed with warnings shown.

2. **Determine version bump**:
   - If user specified bump type, use it
   - Otherwise suggest based on commits: any \`feat\` → minor, only \`fix/refactor/test/etc\` → patch

3. **Bump version** in \`package.json\` (update \`version\` field only)

4. **Generate changelog entry**:
   - Get commits since last tag
   - Classify and group (same as \`/release changelog\`)
   - Prepend new section to \`CHANGELOG.md\` (create file if missing)
   - Format: Keep a Changelog with \`## [v{version}] — {YYYY-MM-DD}\` header

5. **Commit**: \`git add package.json CHANGELOG.md && git commit -m "chore(release): v{version}"\`

6. **Annotated tag**: \`git tag -a v{version} -m "Release v{version}"\`

7. **Write release metadata** to \`.devmanager/release/releases.json\`:
   \\\`\\\`\\\`json
   {
     "version": "v{version}",
     "date": "YYYY-MM-DD",
     "commitRef": "{hash}",
     "stabilityScore": {score},
     "commitCount": {n},
     "description": "{one-line summary of what shipped}",
     "breakdown": { "feat": 3, "fix": 2, "refactor": 1 },
     "gateResults": { "build": "pass", "tests": "pass", ... }
   }
   \\\`\\\`\\\`
   Append to array (create file with \`[]\` if missing).

8. **Annotate codehealth history**: if \`.devmanager/quality/history.json\` exists, add \`"version": "v{version}"\` field to the most recent entry.

9. **Write activity signal** to \`.devmanager/progress/release.json\`:
   \\\`\\\`\\\`json
   { "status": "done", "label": "Released v{version}" }
   \\\`\\\`\\\`

10. **Ask**: "Push to origin? (\`git push && git push --tags\`)"

---

## \\\`/release retroactive\\\`

One-time command: classify all legacy commits, create milestone tags, generate initial CHANGELOG.md.

### Steps

1. **Get all commits**: \`git log --reverse --format="%H %s"\`

2. **Classify each commit** by inferring type from message:
   - Messages starting with "Add" / "Implement" / "Create" → feat
   - "Fix" / "Resolve" / "Repair" → fix
   - "Refactor" / "Clean" / "Simplify" / "Remove" / "Replace" → refactor
   - "Test" / "Add test" → test
   - "Style" / "CSS" / "Design" / "UI" → style
   - "Perf" / "Optimize" / "Speed" → perf
   - "Accessible" / "WCAG" / "a11y" / "aria" → a11y
   - "Security" / "Sanitize" / "XSS" / "CSRF" → security
   - "Doc" / "README" / "Comment" → docs
   - Everything else → chore
   - If message already has conventional commit prefix, use it as-is

3. **Save classifications** to \`.devmanager/release/legacy-commits.json\`:
   \\\`\\\`\\\`json
   {
     "classifiedAt": "YYYY-MM-DD",
     "commits": {
       "{hash}": { "type": "feat", "message": "original message" }
     }
   }
   \\\`\\\`\\\`

4. **Identify milestones**: analyze the commit timeline and group into logical releases. Look for:
   - Major feature clusters (multiple feat commits around same area)
   - Natural breakpoints (architecture changes, new systems introduced)
   - Rough commit count distribution (aim for 3-5 milestones)

5. **Present milestone plan** to user: show proposed tags with commit hashes, descriptions, and commit ranges. **Wait for approval** before creating tags.

6. **Create annotated tags** at approved commits:
   \\\`\\\`\\\`bash
   git tag -a v{version} {commitHash} -m "{milestone description}"
   \\\`\\\`\\\`

7. **Generate initial CHANGELOG.md** with sections for each milestone tag, plus an Unreleased section for commits after the last tag.

8. **Write release metadata** to \`.devmanager/release/releases.json\` — one entry per milestone:
   \\\`\\\`\\\`json
   [
     {
       "version": "v0.1.0",
       "date": "YYYY-MM-DD",
       "commitRef": "{hash}",
       "stabilityScore": 0,
       "commitCount": {n},
       "description": "{milestone description}",
       "breakdown": { "feat": 12, "fix": 5, "refactor": 3, "chore": 8 }
     }
   ]
   \\\`\\\`\\\`
   The \`breakdown\` field counts commits per type for this version. Set \`stabilityScore\` to 0 for retroactive entries (not assessed). The \`date\` is the commit date of the tagged commit.

9. **Update package.json** version to match the latest milestone tag.

10. **Commit**: \`git add CHANGELOG.md package.json .devmanager/release/ && git commit -m "chore(release): retroactive versioning"\`

---

## \\\`/release gate\\\`

Check all release gates. Report pass/fail/warn with reasons.

### Gate definitions

| Gate | ✅ Pass | ⚠️ Warn | ❌ Fail |
|------|--------|---------|--------|
| **Build** | \`npm run build\` exits 0 | — | Non-zero exit |
| **Tests** | \`npm run test:run\` all pass | — | Any failing |
| **Codehealth** | Score ≥7.0 (minor) or ≥6.0 (patch) | Score dropped since last release | Score <6.0 |
| **Regressions** | 0 high-severity backlog items | 1-2 low-severity | Any high-severity |
| **Backlog** | 0 high-severity items | 1 high | 2+ high |
| **Lint** | \`npm run lint\` 0 errors | 1-3 errors | 4+ errors |

### How to check each gate

1. **Build**: run \`npm run build\` and check exit code
2. **Tests**: run \`npm run test:run\` and parse output for pass/fail counts
3. **Codehealth**: read \`.devmanager/quality/latest.json\` → \`overallScore\` field
4. **Regressions**: read \`.devmanager/quality/backlog.json\` → count items with severity "high" and status "open"
5. **Backlog**: same as regressions (combined high-severity count)
6. **Lint**: run \`npm run lint\` and count error lines

### Output format

\\\`\\\`\\\`
## Release Gates

| Gate | Result | Details |
|------|--------|---------|
| Build | ✅ PASS | Clean build in {time}ms |
| Tests | ✅ PASS | {n}/{total} passing |
| Codehealth | ⚠️ WARN | 6.3/10 (dropped from 7.0) |
| Regressions | ❌ FAIL | 3 high-severity items |
| Backlog | ❌ FAIL | 8 high-severity open |
| Lint | ✅ PASS | 0 errors |

Verdict: {BLOCKED / READY WITH WARNINGS / CLEAR}
\\\`\\\`\\\`

---

## Stability assessment algorithm

Deterministic score (0-100) from 6 weighted signals:

\\\`\\\`\\\`
STABILITY = buildTest×0.30 + codehealth×0.20 + fixRatio×0.20
          + backlog×0.15 + regression×0.10 + fixDecay×0.05
\\\`\\\`\\\`

### Component scoring

| Component (weight) | How to score |
|--------------------|-------------|
| **Build/Test (30%)** | Build passes=50pts + (passingTests/totalTests × 50) - (lintErrors × 5). Clamp 0-100 |
| **Codehealth (20%)** | \`overallScore / 10 × 100\` from latest.json (e.g. 6.3 → 63) |
| **Fix Ratio (20%)** | Last 20 commits: ≤20% fixes=100, ≤40%=80, ≤60%=50, >60%=20 |
| **Backlog (15%)** | \`max(0, 100 - highCount×20 - mediumCount×5)\` from backlog.json |
| **Regressions (10%)** | High-severity open items: 0=100, 1=60, 2=30, 3+=0 |
| **Fix Decay (5%)** | Commits since last fix: 0=20, 1-3=50, 4-9=80, 10+=100 |

### How to compute

1. **Build/Test**: run \`npm run build\` (check exit 0) and \`npm run test:run\` (parse passing/total). Run \`npm run lint\` for error count.
2. **Codehealth**: read \`.devmanager/quality/latest.json\` → \`overallScore\`
3. **Fix Ratio**: \`git log -20 --oneline\` → count commits starting with "fix" or "Fix"
4. **Backlog**: read \`.devmanager/quality/backlog.json\` → count items by severity where status is "open"
5. **Regressions**: same data source, filter high-severity open items
6. **Fix Decay**: \`git log --oneline\` → count commits from HEAD until first fix commit

### Stability levels

| Score | Level | Meaning |
|-------|-------|---------|
| 85-100 | Stable | Green light for release |
| 70-84 | Release Candidate | Minor concerns — review warnings |
| 50-69 | Stabilizing | Fixes still landing — wait |
| 0-49 | Active Development | Not release-ready |

---

## Changelog format

Follow [Keep a Changelog](https://keepachangelog.com/) with these sections:

\\\`\\\`\\\`markdown
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [v0.5.0] — 2026-03-28

### Added
- User-facing feature descriptions (from feat commits)

### Fixed
- Bug fix descriptions (from fix commits)

### Changed
- Refactoring/style/perf descriptions (from refactor, style, perf commits)

### Security
- Security improvements (from security commits)

### Accessibility
- Accessibility improvements (from a11y commits)

### Infrastructure
- Tests, docs, tooling changes (from test, docs, chore commits)
\\\`\\\`\\\`

Rules:
- Write in user-facing language, not commit messages
- Omit empty sections
- Most recent version at top
- No commit hashes in entries
- Each entry is one clear sentence

---

## Key rules

1. **Never auto-release.** Always show gate results and wait for user confirmation before cutting.
2. **Never rewrite git history.** Tags are additive. Retroactive tags use \`git tag -a v{x} {hash}\`.
3. **Changelog is user-facing.** Write for someone who uses the product, not the developer.
4. **Stability is deterministic.** Same inputs always produce same score — no subjective adjustments.
5. **Read codehealth data, don't re-scan.** Use existing \`.devmanager/quality/\` files. If stale, suggest running \`/codehealth\` first.
6. **One source of truth per concern.** Version lives in package.json. History lives in git tags. Changelog lives in CHANGELOG.md.
`;
