# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [v0.5.0] — 2026-04-16

### Added
- Tauri desktop app with full feature parity (terminal launch, attachments, multi-project, split-tasks, changelog)
- API contract with OpenAPI spec, WebSocket protocol, and configurable HOST
- Pipeline launcher with phase context injection for orchestrated execution
- Auto model routing for subagent cost control with game dev and expanded keyword patterns
- Terminal mode for scratchpad split tasks
- Error tracker panel rebuilt on clean architecture
- Extracted agent-runner and sync-protocol packages (onion architecture)

### Fixed
- Task preview popup for done tasks, hide completed epics from pill bar
- Worktree branch name discovery with '+' prefix in merge-safe and git branch output
- Fallback 'done' progress written when process exits with code 0
- Scratchpad closes immediately after split, arranges in background
- Terminal split uses interactive claude session like task launches
- Claude output streaming to terminal using Tee-Object
- Prompt piping via stdin for terminal split with error diagnostics
- Arrange waits to complete during split so phases settle before queue interaction
- Duplicate activity entries prevented when progress files are re-read
- Native folder picker for Tauri using PowerShell/osascript/zenity
- Vite plugin swaps api.ts for tauri-api.ts at resolve time
- Tauri Vite config with correct root, imports, and entry paths
- Server validation enhanced with badge-blocked contrast fix
- State API response validation for data integrity
- Descriptive error messages and state reset on launch failure
- Unsafe type casts removed and schema validation added
- Atomic lock acquisition, referential integrity checks, and consolidated TaskStatus
- TypeScript errors in EpicGroup guards, TaskBoard map types, and node types
- Launch button styling with proper padding and positioning

### Changed
- Renamed @dev-manager/engine to taskgraph
- Extracted orchestration engine into standalone package

### Infrastructure
- Cleaned up repo with rewritten CLAUDE.md and gitignore for .devmanager/ artifacts
- Removed dead re-exports (activityUtils shim, MergeResult type)
- Added release skill, changelog, and updated skill templates
- Updated test data for stricter server validation

## [v0.4.0] - 2026-03-29

Architecture refactoring and hardening - extracted hooks, split route modules, converted inline styles, added security fixes.

### Added
- Toggle epics visibility on task board
- Delete epic with all tasks
- ActionContext to eliminate prop drilling of 40+ handlers
- Validation warnings for unknown task IDs, circular dependencies, and activity truncation
- Typed WebSocket messages with unsafe cast removal
- Comprehensive integration tests for server API routes
- Server-side security hardening (5 fixes)
- Test coverage for api.ts and 4 untested hooks
- Input validation for external data at system boundaries
- Multi-select and bulk actions for task board
- Editable "what shipped" field on done tasks
- Release skill with UI panel, stability assessment, and changelog viewer
- Major/minor/patch bump selector for Cut Release button
- Collapsible depends-on section when task has no dependencies
- Scratchpad stays open until split-into-tasks completes

### Fixed
- Concurrent state.json writes causing data loss
- Branch name parsing in merge-safe and queue-next scripts
- Tasks disappearing from queue when launched
- ESLint react-hooks errors blocking CI
- Queue re-launch bug
- Dependency cycle breaking, cascade queue removal, and atomic merge lock
- WCAG contrast issues in mixed-concern components
- Tasks stuck at "Merging to master" due to progress file race
- Quality panel dropping dimensions when data uses aliased key names
- Merge-safe atomically marks tasks done to prevent orphaned in-progress state
- Missing dimension keys in quality history charts

### Changed
- Extracted useConnection, useSync, useTemplate, useScratchpad, useTabRouting hooks from App.tsx
- Extracted shared taskFilters and createActivityList utilities
- Simplified TaskBoard memoization (removed 1 memo, consolidated 4 into 2)
- Extracted server/dialogs.js and server/middleware.js modules
- Split server/api.js into 8 focused route modules with tests
- Converted all inline styles to CSS utility classes across every component
- Refactored tests for AAA compliance (one behavior per test)
- Redesigned codehealth skill around agent readiness over code aesthetics
- Redesigned launch buttons: click runs inline, terminal icon opens terminal
- Refactored release panel: deduplicated LaunchButtons, extracted constants

### Security
- Fixed command injection in terminal launch commands
- Fixed path traversal vulnerabilities in server routes
- Replaced catch(err: any) with proper unknown narrowing
- Replaced silent error handlers with console.warn logging
- Added user-visible error toasts for sync failures

## [v0.3.0] - 2026-03-24

Bridge server and live execution - cross-platform support, live AI output streaming, scratchpad, and push deployment.

### Added
- Bridge server for cross-platform HTTP + WebSocket support
- Multi-project switching with server auto-start and improved connection UX
- Project templates: Game, Web, Mobile starter kits with template picker
- Engine selector with project-level default and per-task override
- Live output panel streaming AI process output in the queue
- Native OS folder dialog for project switching (Windows 11 modern dialog)
- Terminal launch option: run tasks in background or open in terminal
- Phase-based color coding for orchestrator progress in queue
- Push button to deploy completed work to origin with one click
- Scratchpad: dump findings while testing, AI splits into tasks
- Pipeline legend with visual progress bar showing agent phases
- Error state with retry button for failed background tasks
- Arrow connectors between pipeline stages
- Completion summaries showing what each agent shipped
- Task ID numbers on each task card
- Test coverage % and dependency vulnerability metrics on quality dashboard
- Linux support for protocol handler and launcher

### Fixed
- Terminal launch quoting and permissions flag ordering
- Arrange command conversion for background mode
- Arrange launch allowing taskId 0
- Launch phase showing "Launching..." on all tasks
- Double completion: only write progress on failure, let orchestrator handle success
- Overlapping labels in Score History timeline chart
- Syntax error from duplicate closing brace in process.js

### Changed
- Moved scratchpad to floating button + drawer with concrete placeholder examples
- Improved Windows Terminal pane layout and launch cleanup
- Split TaskDetail into ActionButtons and TaskFlags subcomponents
- Updated README to reflect current architecture

### Infrastructure
- README with setup and usage instructions (simplified quick-start guide)

## [v0.2.0] - 2026-03-18

Quality and engineering foundations - TypeScript migration, test framework, accessibility, CI pipeline, and component architecture.

### Added
- Quality tab with project health dashboard, radar chart, scorecard, and trends
- Scan and healthcheck buttons on Quality tab
- Autofix skill with hash-based skill deployment
- Vitest test framework with 25 unit tests for core business logic
- Keyboard accessibility: focus-visible, ARIA labels, keyboard handlers
- TypeScript migration with proper types across all components
- Error boundary, loading skeleton, and graceful state.json handling
- ESLint 9 with TypeScript and React plugins
- Auto-approve checkbox to skip plan presentation
- Auto-approve toggles: per-task, per-phase, and queue-wide
- Expanded test coverage: queueUtils, fs.ts, hooks, and utilities
- GitHub Actions CI pipeline for lint, typecheck, test, and build
- Smoke tests for 5 key UI components
- Interaction tests and error path coverage
- ARIA-live regions for queue progress and status select

### Fixed
- Radar chart clipping with larger canvas and label padding
- PowerShell injection in PS1 scripts with URL-encoded parameters
- URL encoding bug in LaunchButtons launch function
- TypeScript errors and replaced all `as any` casts with proper types
- Silent error swallowing with logging and error toasts for user feedback
- Batch update regression in CommandQueue
- All ESLint issues (16 errors resolved to 0)
- Dropped onBatchUpdateTasks prop in CommandQueue

### Changed
- Split TaskDetail into 4 subcomponents under detail/ directory
- Split TaskBoard into 4 board subcomponents for maintainability
- Split QualityPanel (738 LOC) into focused subcomponents under quality/
- Split CommandQueue into focused subcomponents (414 to 110 LOC)
- Migrated inline styles to CSS classes in components.css
- Orchestrator speaks product language, not code
- Runtime data validation for state.json, progress files, and quality reports
- Centralized all user-facing UI strings into constants
- Tokenized canvas hex colors into CSS custom properties
- Backlog status, queue-by-group, activity navigation to done/backlog tasks

### Security
- Escaped all shell metacharacters in escapePS and escapeCmd to prevent injection

### Accessibility
- Added aria-label to role='button' elements for screen readers
- Added aria-expanded, canvas roles, and mobile focus trap
- Fixed dark theme hardcoded colors

## [v0.1.0] - 2026-03-15

Core MVP - task board, queue, orchestrator protocol, dependencies, epics, and multi-project support.

### Added
- Browser-based task management board with 2x2 grid layout
- Tech lead orchestrator with dark mode toggle
- One-click orchestrator launch via claudecode:// protocol
- Per-task terminal launch with named tabs
- Task deletion for pending tasks
- Live progress tracking and rich activity feed
- Task dependencies with flow view, dependency picker, and auto-sorted queue
- "Arrange tasks" button for AI-powered dependency analysis
- "Launch phase" for parallel task groups
- Screenshot attachments with paste, drag-drop, and thumbnails per task
- Queue all / Unqueue all buttons
- Task search and status filter on TaskBoard
- Blocked reason field for tasks
- Task timeline with creation, start, and completion timestamps
- Responsive layout with 900px breakpoint and detail panel overlay
- Epics, manual task creation, and done section
- Epic overview with progress bars and per-group counters
- State backup and undo for destructive operations
- Git worktrees for parallel task isolation
- Multi-project support with per-tab sessions and always-visible picker
- Editable task descriptions
- Branch-per-task workflow with pause/resume and queue status indicators
- Activity feed with clickable items and glow navigation
- Favicon and dynamic tab title per project

### Fixed
- React hooks ordering (useState before conditional return)
- Project path restoration from localStorage after reconnect
- Protocol URL space encoding
- Parallel task progress file conflicts
- Detail panel overlay on mobile
- Phase launch issues
- Timeline completedAt timezone bug

### Changed
- Redesigned activity feed with inline layout, colored dots, today/older sections
- Split single HTML file into Vite + React project structure
- Removed drafts for single unified task model
- CSS design token system with --dm-* prefix
- Redesigned dependency picker with clear selected vs available distinction
- Orchestrator rewritten for balanced execution (202 lines)
- Extracted useTaskActions and useQueueActions hooks from App
- Extracted shared constants: STATUS, EPIC_PALETTE, PAUSED_COLOR
