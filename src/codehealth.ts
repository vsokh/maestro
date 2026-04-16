export const CODEHEALTH_SKILL_TEMPLATE: string = `---
name: codehealth
description: "Agent readiness scanner. Measures how verifiable the codebase is — can an agent safely change code, run validation gates, and know the change is correct? Scores 6 dimensions + web app health check. Creates Quality tasks for the orchestrator to fix. TRIGGER on: codehealth, code health, quality audit, code quality, project health, assess quality, audit codebase, quality report, check health, agent readiness, scan, desloppify."
---

# Codehealth — Agent Readiness Scanner

You measure how **verifiable** this codebase is. The core question: can an AI agent pick up this code, make a change, run validation gates, and know the change is correct?

The limiter of agent productivity is never the agent — it's the **validation environment**. Codehealth measures that environment across 6 dimensions + a web app health check, tracks trends, and creates tasks for the orchestrator to fix gaps.

**Codehealth does NOT fix code.** It finds gaps in verifiability, scores them, and creates tasks in dev-manager under the "Quality" group. The orchestrator picks them up.

Philosophy: a high score means an agent can work autonomously with confidence. A low score means agents need hand-holding because there's no automated way to verify their work. Improving the score creates a feedback loop — better validation leads to better agent output leads to better code.

---

## Invocation modes

| Command | What it does |
|---------|-------------|
| **\\\`/codehealth\\\`** or **\\\`/codehealth scan\\\`** | Full audit: LLM review (6 dims) + web app health check + write report + create Quality tasks |
| **\\\`/codehealth quick\\\`** | Web app health check only (automated metrics, no LLM review, no file writes) |
| **\\\`/codehealth diff\\\`** | Incremental: re-score only dimensions affected by files changed since last scan |

---

## File layout

| File | Purpose | Who writes |
|------|---------|-----------|
| \\\`.maestro/quality/latest.json\\\` | Current scores + findings | This skill |
| \\\`.maestro/quality/history.json\\\` | Score history (max 20 entries) | This skill |
| \\\`.maestro/quality/backlog.json\\\` | Prioritized fix queue | This skill |
| \\\`.maestro/state.json\\\` | Dev-manager tasks | Only via scan mode |

---

## SCAN mode — full audit

### Step 0 — Discover project structure

Read \\\`package.json\\\` (or equivalent) to determine:
- Language/framework, build/lint/test commands, source directory
- TypeScript vs JavaScript vs other, styling approach, state management
- What validation gates already exist (linters, type checking, tests, CI)

Adapt ALL subsequent steps to the actual project.

### Step 1 — Web App Health Check (hard data)

Run automated measurements. This is the "does the app actually work" check. Launch commands in parallel where possible:

**Build**
\\\`\\\`\\\`bash
# Run the project's build command (npm run build, cargo build, go build, etc.)
# Capture: pass/fail, warning count
\\\`\\\`\\\`

**Lint**
\\\`\\\`\\\`bash
# Run lint command (npx eslint ., cargo clippy, ruff check ., etc.)
# Capture: error count, warning count
\\\`\\\`\\\`

**Tests + Coverage**
\\\`\\\`\\\`bash
# Run tests with coverage (npx vitest run --coverage, pytest --cov, etc.)
# Capture: pass/fail count, coverage %, failing test names
\\\`\\\`\\\`

**Bundle size** (frontend projects)
\\\`\\\`\\\`bash
# Parse build output for bundle size (gzip), largest chunks
\\\`\\\`\\\`

**Dev server check** (web apps)
\\\`\\\`\\\`bash
# Start dev server, wait for ready, check for:
# - Does it start without errors?
# - Any console warnings/errors on startup?
# - Kill after check
\\\`\\\`\\\`

**Lighthouse** (web apps with a running dev server)
\\\`\\\`\\\`bash
# npx lighthouse http://localhost:<port> --output=json --chrome-flags="--headless --no-sandbox"
# Capture: performance, best-practices, SEO scores
# Skip if no browser environment available
\\\`\\\`\\\`

**API health** (if API routes are detectable)
\\\`\\\`\\\`bash
# Hit discoverable API routes (from route files, OpenAPI spec, etc.)
# Capture: status codes, response shape validation
# Skip if no API layer detected
\\\`\\\`\\\`

**Dependency audit**
\\\`\\\`\\\`bash
# npm audit --json / yarn audit / pip-audit / govulncheck
# Capture: vulnerability counts by severity (critical, high, moderate, low)
\\\`\\\`\\\`

Store all results in a \\\`healthCheck\\\` object in the report. This is a separate dashboard from the code quality score — it's not rolled into the weighted average. It answers: "does the app work right now?"

### Step 2 — LLM review (the real assessment)

This is what makes it better than grep. For each of the 6 dimensions, **read the actual code** and judge quality with understanding. Launch up to 3 Explore agents in parallel:

**Agent 1 — Type Safety + Error Handling review:**

Discover and read:
- Type definitions, domain models, data layer — Are types comprehensive? Any escape hatches (\\\`any\\\`, \\\`object\\\`, untyped casts, \\\`// @ts-ignore\\\`)?
- All error handling blocks — Is the error surfaced to the user or logged and swallowed? Are catch blocks typed (\\\`catch(err: unknown)\\\` with narrowing, not \\\`catch(err: any)\\\`)?
- API boundaries — Are external data (API responses, DB rows, user input) validated/typed at the boundary?
- Return types — Are they explicit or inferred as \\\`any\\\`?

**Agent 2 — Test Quality + Security review:**

Discover and read:
- Test files — Check **AAA compliance** (Arrange-Act-Assert): does each test have one setup, one action, one set of related assertions? Flag: multi-behavior tests (more than one reason to fail), duplicate tests, tests asserting on implementation details rather than behavior, redundant assertions.
- Coverage gaps — Which modules have zero tests? Are error paths covered? Are business rule files tested?
- Test patterns — Behavior vs implementation testing? Mock quality?
- Auth/security layer — Access control, token handling, injection vectors, hardcoded secrets, input validation
- Dependencies — Known-vulnerable patterns, outdated critical packages

**Agent 3 — Clean Architecture + Domain Logic review:**

Discover and read, scoring against Robert Martin's Clean Code principles:
- **Function length** — Functions should be small. Flag functions >25 LOC. A 50-line function is almost always doing too much.
- **Function arguments** — 0-2 is ideal. 3+ is a code smell. Flag functions with 4+ parameters.
- **Single Responsibility** — Does each file/module/class have one reason to change? Or is it mixing concerns (data fetching + UI + validation in one file)?
- **Nesting depth** — Flag nesting >3 levels deep. Deep nesting means complex control flow.
- **Dependency direction** — Do dependencies point inward? Or does core logic import from UI/infrastructure layers?
- **DRY** — Flag duplicate code blocks (3+ similar lines appearing in multiple places).
- **Domain logic correctness** — Are business rules accurate? Edge cases handled (zero values, boundaries)? Are calculations correct per spec/constants?

**DO NOT just count.** Read and judge: "This function is 40 lines but it's a clean linear pipeline — acceptable" or "This 15-line function mixes 3 concerns — needs splitting."

### Step 3 — Score each dimension

Score 1-10 based on the LLM review + hard metrics. Each score must include:

\\\`\\\`\\\`json
{
  "score": 7,
  "weight": "high",
  "confidence": "reviewed",
  "evidence": "Read 8 service files. 5/8 have typed returns. 3 still use untyped patterns.",
  "issues": 3,
  "findings": [
    {
      "id": "ts-001",
      "severity": "high",
      "file": "src/services/userService.ts",
      "line": 45,
      "finding": "Untyped database query result. Agent cannot verify schema correctness.",
      "fix": "Create typed interface for this query result",
      "effort": "small"
    }
  ]
}
\\\`\\\`\\\`

**Confidence levels:**
- \\\`"measured"\\\` — from build/lint/test output (objective)
- \\\`"reviewed"\\\` — LLM read the code and judged (informed opinion)
- \\\`"estimated"\\\` — inferred from grep counts without reading context (low confidence)
- \\\`"not-applicable"\\\` — dimension doesn't apply to this project type (scored 10)

### Step 4 — Build backlog

Collect all findings. Sort by:
1. Severity (high > medium > low)
2. Dimension weight (high > medium)
3. Effort (small fixes first within same severity — quick wins)

Write to \\\`.maestro/quality/backlog.json\\\`:

\\\`\\\`\\\`json
{
  "generatedAt": "2026-03-28",
  "commitRef": "f1d3999",
  "items": [
    {
      "id": "ts-001",
      "dimension": "typeSafety",
      "severity": "high",
      "effort": "small",
      "file": "src/services/userService.ts",
      "line": 45,
      "finding": "Untyped query result - agent cannot verify schema correctness",
      "fix": "Create typed interface for query result",
      "status": "open"
    }
  ]
}
\\\`\\\`\\\`

### Step 5 — Trend analysis

Read previous \\\`latest.json\\\`. Compare each dimension. Flag:
- Any dimension that **dropped by 1+** — regression warning
- Any dimension that **improved by 2+** — highlight win
- Dimensions **flat for 3+ audits** — stale

### Step 6 — Write outputs

1. **\\\`latest.json\\\`** — scores + top 10 findings + health check results
2. **\\\`history.json\\\`** — append entry (keep last 20)
3. **\\\`backlog.json\\\`** — full prioritized finding list
4. **\\\`reports/YYYY-MM-DD.md\\\`** — human-readable report

---

## Scoring

### Code Quality Score (weighted average of 6 dimensions)

- **HIGH weight (20% each = 80% total):**
  - Type Safety
  - Test Quality
  - Error Handling
  - Security

- **MEDIUM weight (10% each = 20% total):**
  - Clean Architecture
  - Domain Logic

**Grade:** A (9+), A- (8-8.9), B+ (7-7.9), B (6-6.9), B- (5-5.9), C+ (4-4.9), C (3-3.9), D (<3)

### Web App Health Check (separate dashboard, not in score)

Reported as a status board:
\\\`\\\`\\\`
Build: passing | Lint: 0 errors | Tests: 56/56 (74% coverage) | Bundle: 84KB gzip
Lighthouse: perf 92, practices 96, SEO 89 | Deps: 0 vulns | Dev server: clean
\\\`\\\`\\\`

---

## QUICK mode — web app health check only

Run the automated measurements from Step 1 only. No LLM review, no file writes. One-paragraph output:

\\\`\\\`\\\`
Health check - 2026-03-28, commit f1d3999:
Build: passing | Lint: 3 errors | Tests: 56/56 (74% coverage) | Bundle: 84KB gzip
Lighthouse: perf 92, practices 96, SEO 89 | Deps: 0 vulns
vs last scan: lint -2, tests +4, coverage +2%, bundle +1KB
\\\`\\\`\\\`

---

## DIFF mode — incremental re-scan

1. Read \\\`latest.json\\\` — get \\\`commitRef\\\` from last scan
2. \\\`git diff {commitRef}..HEAD --name-only\\\` — list changed files
3. Map changed files to affected dimensions based on file type and location
4. Re-scan ONLY affected dimensions (LLM review on changed files)
5. Carry forward unchanged dimension scores from \\\`latest.json\\\`
6. Write updated report

---

## Creating tasks in dev-manager (automatic on scan)

Every scan reads \\\`backlog.json\\\` and creates/updates tasks in \\\`.maestro/state.json\\\` under the **Quality** group.

### Mapping rules

| Finding field | Task field |
|--------------|-----------|
| \\\`dimension\\\` | \\\`group\\\` = \\\`"Quality"\\\` (all quality tasks use one group) |
| \\\`dimension\\\` label | prefix in task name (e.g., "Type Safety: 5 untyped returns") |
| \\\`fix\\\` | \\\`description\\\` |
| \\\`severity\\\` high/medium | task created with \\\`"status": "pending"\\\` |
| \\\`severity\\\` low | skipped (keep in backlog only) |
| \\\`effort\\\` small | added to notes: "Quick fix" |
| \\\`effort\\\` large | added to notes: "Requires planning" |

### Process

1. Read \\\`backlog.json\\\` — filter to high + medium severity, \\\`"status": "open"\\\`
2. Read \\\`.maestro/state.json\\\` — get current tasks + next available ID
3. **Group findings by dimension** — create ONE task per dimension if multiple related findings exist, or separate tasks if they're in different areas
4. Set \\\`group\\\` = \\\`"Quality"\\\`. Add Quality epic if not present.
5. **De-duplicate:** check if a task with similar name already exists. Skip if found. If an existing task is already done, and the finding reappeared, create a new task (regression).
6. Write updated \\\`state.json\\\`
7. Report: "Created N Quality tasks in dev-manager. Launch orchestrator to fix them."

### CRITICAL rules for writing state.json

- **Get real timestamp:** Before writing, run \\\`node -e "console.log(Date.now())"\\\` and use that value for any \\\`time\\\` field. NEVER construct timestamps manually.
- **No special characters in text fields:** Use \\\` - \\\` (space-hyphen-space) instead of em dashes. Plain ASCII quotes only.
- **Preserve ALL existing data:** Keep every existing task, queue item, activity entry, and epic. Only ADD new tasks and a single new activity entry.
- **Activity entry format:**
  \\\`\\\`\\\`json
  { "id": "act_{timestamp}_scan", "time": {timestamp}, "label": "Code health scan: {score}/10 ({grade}) - {summary}" }
  \\\`\\\`\\\`

---

## Dimensions reference

### 1. Type Safety (HIGH)

**What it measures:** Can an agent understand data contracts without reading all the code?

What to review:
- Type escape hatches: \\\`any\\\`, \\\`object\\\`, \\\`as\\\` casts, type ignores, \\\`// @ts-ignore\\\`
- Untyped external data: API responses, DB rows, user input — is there a typed boundary?
- Catch block typing: \\\`catch(err: unknown)\\\` with \\\`instanceof\\\` narrowing, not \\\`catch(err: any)\\\`
- Return type annotations: explicit or inferred as \\\`any\\\`?
- Generic usage: properly constrained or \\\`<any>\\\`?

**Scoring guide:**
- **9-10:** Near-zero type escape hatches. All external data typed at boundary. Agents can trust type signatures.
- **7-8:** A few escape hatches in non-critical paths. External data mostly typed.
- **5-6:** Significant untyped areas. Agents must read implementation to understand contracts.
- **3-4:** Pervasive \\\`any\\\` usage. Types provide almost no guidance.
- **1-2:** No type system or entirely ignored. Agents are flying blind.

### 2. Test Quality (HIGH)

**What it measures:** Can an agent verify its changes are correct?

What to review:
- **Coverage:** Which modules have tests? Which have zero? Are business rules tested?
- **AAA compliance:** Every test should follow Arrange-Act-Assert. Flag:
  - Multi-behavior tests (asserts on unrelated outcomes — more than one reason to fail)
  - Mixed act+assert (multi-step interactions with asserts between steps)
  - Duplicate tests (identical setup, action, assertion)
  - Implementation testing (asserts on internals rather than observable behavior)
  - Redundant assertions (e.g., \\\`expect(getByText('X')).toBeDefined()\\\` where \\\`getByText\\\` throws if not found)
- **Error path coverage:** Are failure scenarios tested, not just happy paths?
- **Test utility quality:** Good helpers, factories, shared setup?
- **Behavior vs implementation:** Tests should break when behavior changes, not when internals are refactored.

**Scoring guide:**
- **9-10:** >80% coverage, clean AAA, all business rules tested, error paths covered. Agent changes get immediate pass/fail signal.
- **7-8:** >60% coverage, mostly clean AAA, key paths tested. Some gaps but agent can mostly verify changes.
- **5-6:** 40-60% coverage, some AAA violations, major modules untested. Agent must manually verify some changes.
- **3-4:** <40% coverage, many tests test implementation details. Agent gets unreliable signals.
- **1-2:** Near-zero tests. Agent has no way to verify changes.

### 3. Error Handling (HIGH)

**What it measures:** Are failures visible? Can an agent debug issues?

What to review:
- Mutation/write feedback: Does the user see success AND failure? Or do writes fail silently?
- Catch block quality: User feedback vs log-and-swallow vs empty catch
- Error boundaries / middleware: Are unexpected errors caught at the top level?
- Loading/error states: Do UI components handle loading, error, and empty states?
- Console-only errors: Errors logged to console but invisible to users are invisible to agents too

**Scoring guide:**
- **9-10:** All mutations give user feedback. No silent failures. Agents can trace any error through the system.
- **7-8:** Most errors surfaced. A few console-only error paths.
- **5-6:** Mixed. Some operations fail silently. Agents would miss some failure modes.
- **3-4:** Many empty catches, log-and-swallow patterns. Agents can't tell when things break.
- **1-2:** No error handling strategy. Failures are invisible.

### 4. Security (HIGH)

**What it measures:** Will an agent introduce vulnerabilities by following existing patterns?

What to review:
- Input validation: Is user input validated at system boundaries?
- Auth/authorization: Are there clear patterns agents can follow?
- Injection vectors: XSS, SQL injection, command injection, path traversal
- Secrets: Any hardcoded API keys, credentials, tokens in source?
- Dependency vulnerabilities: From the audit in Step 1
- Access control: RLS policies, middleware guards, route protection

**Scoring guide:**
- **9-10:** Clear security patterns throughout. Input validated at boundaries. No secrets in source. Agents would follow safe patterns by default.
- **7-8:** Mostly secure. A few missing validations in non-critical paths.
- **5-6:** Inconsistent. Some paths validated, others not. Agents might follow an unsafe pattern.
- **3-4:** Significant gaps. Missing auth checks, unvalidated input in critical paths.
- **1-2:** Hardcoded secrets, no input validation, wide-open access.

### 5. Clean Architecture (MEDIUM)

**What it measures:** Can an agent find where to make changes and follow existing structure?

Informed by Robert Martin's Clean Code / Clean Architecture. These are signals, not hard rules — use judgment:

- **Function focus:** Are functions doing one thing? A long function with a clear linear flow is fine. A short function mixing three concerns is not.
- **Single Responsibility:** Does each file/module have one reason to change? Flag files mixing unrelated concerns (data fetching + UI + validation in one place).
- **Nesting and complexity:** Is the control flow easy to follow? Deep nesting and complex conditionals make code hard for agents to reason about.
- **Dependency direction:** Do dependencies flow in a clear direction? Core logic should not import from UI/infrastructure layers.
- **DRY vs premature abstraction:** Flag obvious duplication. But three similar lines is better than a forced abstraction nobody understands.
- **Style containment** (frontend projects): Styles are an architecture concern — they must be contained, not sprawled. Check:
  - Are styles organized in dedicated CSS files (by feature or component), not scattered inline across .tsx/.jsx files?
  - Is there a design system (CSS variables/tokens file)? Are colors, spacing, radii defined as tokens, not hardcoded hex/px values in components?
  - Inline styles in components should be justified (dynamic values like \\\`width: percent%\\\`, animation delays). Lazy inline styles (static colors, margins, padding) are SRP violations — they belong in CSS files.
  - Dead/unused CSS selectors? Duplicated declarations across files?
  - Consistent naming convention for CSS classes?
  A well-contained style system means an agent can change a color in one place, not hunt through 40 component files.

**Scoring guide:**
- **9-10:** Small focused functions, clear module boundaries, consistent patterns. Styles contained in dedicated files with design tokens. Agent knows exactly where to put new code and new styles.
- **7-8:** Mostly clean. A few large files or deep functions. Styles mostly contained, a few justified inline exceptions.
- **5-6:** Mixed. Some god files, some clean modules. Styles starting to sprawl — inline styles mixed with CSS files. Agent has to guess where things go.
- **3-4:** Large tangled files, deep nesting, no clear structure. Styles scattered across components with hardcoded values. Agent frequently puts code in the wrong place.
- **1-2:** Everything in one file or no discernible structure. No style organization.

### 6. Domain Logic (MEDIUM)

**What it measures:** Are business rules correct and testable?

What to review:
- Business rule accuracy: Calculations, state transitions, categorization logic
- Edge cases: Zero values, boundary conditions, overflow, empty collections
- Rule consistency: Do constants match usage? Do enums cover all cases?
- Derived state: Do computed values agree with source data?
- Testability: Are business rules isolated enough to test without UI/DB?

**Scoring guide:**
- **9-10:** Rules isolated, tested, edge cases handled. Agent can modify rules and verify correctness.
- **7-8:** Mostly correct. A few untested edge cases.
- **5-6:** Some rules buried in UI code. Edge cases not handled. Agent can't verify rule changes.
- **3-4:** Business logic scattered across many files. No dedicated tests.
- **1-2:** No identifiable business rules or entirely untested logic.

For projects with no business rules (pure CRUD, static sites): score 10 with \\\`"confidence": "not-applicable"\\\`.

---

## Key rules

1. **Read code, don't just grep.** The LLM review IS the assessment. Grep counts are supporting evidence.
2. **Every finding needs a file path + line number + concrete fix.** No vague "improve error handling."
3. **Frame findings as agent readiness gaps.** "An agent cannot verify X because Y" — not just "X is bad."
4. **The web app health check is separate from the score.** It's a status dashboard, not a dimension.
5. **Trends over absolutes.** A 6 that was a 4 is great. A 6 that was an 8 is alarming.
6. **Small fixes first.** In the backlog, pick quick wins within the same severity tier.
7. **Don't commit.** Scan and report only, let the user decide next steps.
8. **Be honest.** If you can't assess something, say \\\`"confidence": "estimated"\\\` and explain why.
9. **Adapt to the project.** Don't score domain logic if there are no business rules. Mark irrelevant dimensions as 10 with \\\`"confidence": "not-applicable"\\\`.
`;
