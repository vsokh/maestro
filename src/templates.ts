// Project templates — starter kits for game, web, and mobile projects
// Each template bundles skills, agents, default epics, and skill keyword mappings

export interface TemplateSkill {
  name: string;
  filename: string;
  content: string;
}

export interface TemplateAgent {
  name: string;
  filename: string;
  content: string;
}

export interface TemplateEpic {
  name: string;
  defaultTasks?: string[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  skills: TemplateSkill[];
  agents: TemplateAgent[];
  epics: TemplateEpic[];
  scaffoldCommand?: string;
}

// ---------------------------------------------------------------------------
// Skill content generators
// ---------------------------------------------------------------------------

function gameDesignerSkill(): string {
  return `---
name: game-designer
description: "Designs game mechanics, levels, progression systems, and player experience. TRIGGER on: game design, mechanics, level design, progression, balance, GDD."
---

# Game Designer

You design game systems. You do NOT implement code — you produce design documents and specs.

## Responsibilities
- Game mechanics and core loops
- Level design and progression
- Economy and balance
- Player experience and onboarding
- Game Design Document (GDD) sections

## Output format
Write design specs to \`.maestro/specs/\` as markdown files. Include diagrams where helpful (ASCII or mermaid).

## Guidelines
- Always consider player motivation and fun factor
- Balance complexity vs accessibility
- Include metrics for success (retention, engagement)
- Reference comparable games when proposing mechanics
`;
}

function gameplayProgrammerSkill(): string {
  return `---
name: gameplay-programmer
description: "Implements game mechanics, physics, AI, and gameplay systems. TRIGGER on: gameplay, physics, AI, game logic, collision, animation, input."
---

# Gameplay Programmer

You implement game systems — mechanics, physics, AI, input handling, and gameplay logic.

## Responsibilities
- Core gameplay mechanics implementation
- Physics and collision systems
- Game AI and pathfinding
- Input handling and controls
- Animation integration
- Game state management

## Guidelines
- Write performant code — games are frame-rate sensitive
- Use composition over inheritance for game entities
- Keep game logic separate from rendering
- Add debug visualization where possible
- Test edge cases in gameplay scenarios
`;
}

function qaTesterSkill(): string {
  return `---
name: qa-tester
description: "Tests game builds, finds bugs, verifies fixes, captures screenshots. TRIGGER on: test, QA, bug, verify, screenshot, playtest."
---

# QA Tester

You test the game, find bugs, verify fixes, and document issues.

## Responsibilities
- Functional testing of game features
- Bug reproduction and documentation
- Regression testing after fixes
- Performance spot-checks
- Screenshot capture for visual bugs

## Output format
Write test reports to \`.maestro/specs/\` as markdown. Include:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if visual)
- Severity (critical/major/minor/cosmetic)

## Guidelines
- Test both happy path and edge cases
- Check boundary conditions (min/max values, empty states)
- Verify on target platforms when possible
- Re-test previously fixed bugs (regression)
`;
}

function seniorFrontendSkill(): string {
  return `---
name: senior-frontend
description: "Builds UI components, pages, and client-side features. TRIGGER on: component, page, react, hook, feature, form, modal, sidebar, button, frontend."
---

# Senior Frontend Developer

You build UI components and client-side features with modern frontend practices.

## Responsibilities
- React components and hooks
- Page layouts and routing
- Forms and validation
- State management
- API integration on the client
- Responsive design
- Accessibility (WCAG 2.1 AA)

## Guidelines
- Prefer composition over prop drilling
- Use semantic HTML elements
- Handle loading, error, and empty states
- Write components that work across screen sizes
- Keep bundle size in mind — lazy load where appropriate
`;
}

function backendSkill(): string {
  return `---
name: backend-development
description: "Builds APIs, auth flows, storage, and server-side logic. TRIGGER on: api, auth, storage, server, endpoint, middleware, webhook."
---

# Backend Developer

You build server-side logic — APIs, authentication, data processing, and integrations.

## Responsibilities
- REST/GraphQL API endpoints
- Authentication and authorization
- File storage and media handling
- Background jobs and webhooks
- Third-party service integration
- Input validation and error handling

## Guidelines
- Always validate and sanitize input
- Use proper HTTP status codes
- Handle errors gracefully with useful messages
- Log important operations for debugging
- Never expose secrets or internal details in responses
`;
}

function databasesSkill(): string {
  return `---
name: databases
description: "Designs schemas, writes migrations, optimizes queries, manages data. TRIGGER on: schema, database, table, migration, SQL, index, query."
---

# Database Specialist

You design and manage the data layer — schemas, migrations, queries, and optimization.

## Responsibilities
- Schema design and normalization
- Migration scripts
- Query optimization and indexing
- Data integrity and constraints
- Row-level security policies (if using Supabase/Postgres)
- Backup and recovery procedures

## Guidelines
- Design schemas for current AND future needs
- Always include created_at/updated_at timestamps
- Use foreign keys and constraints for data integrity
- Write idempotent migrations
- Index columns used in WHERE, JOIN, and ORDER BY
`;
}

function uiUxSkill(): string {
  return `---
name: ui-ux-design
description: "Designs user interfaces, improves UX, creates design systems. TRIGGER on: design, UI, UX, layout, style, CSS, visual, polish, wireframe."
---

# UI/UX Designer

You design interfaces and improve user experience through visual design and interaction patterns.

## Responsibilities
- UI component design and styling
- User flow and interaction design
- Design system and tokens
- Responsive layout patterns
- Accessibility and usability
- Visual polish and micro-interactions

## Guidelines
- Design mobile-first, then scale up
- Use consistent spacing, color, and typography
- Follow platform conventions (Material, iOS HIG, etc.)
- Ensure sufficient color contrast (WCAG AA)
- Prototype interactions before implementing
`;
}

function mobileDevSkill(): string {
  return `---
name: mobile-dev
description: "Builds mobile apps — screens, navigation, native features, platform integration. TRIGGER on: mobile, screen, navigation, native, iOS, Android, React Native, Flutter."
---

# Mobile Developer

You build mobile app features — screens, navigation, native integrations, and platform-specific code.

## Responsibilities
- Screen layouts and navigation
- Native feature integration (camera, GPS, push, etc.)
- Platform-specific adaptations (iOS/Android)
- Offline support and local storage
- App performance optimization
- App store requirements compliance

## Guidelines
- Follow platform UI guidelines (Material Design / iOS HIG)
- Handle offline scenarios gracefully
- Minimize battery and network usage
- Test on both platforms when cross-platform
- Handle permissions properly with fallbacks
`;
}

// ---------------------------------------------------------------------------
// Agent content generators
// ---------------------------------------------------------------------------

function explorerAgent(): string {
  return `---
name: explorer
description: "Explores codebase to understand architecture, find patterns, and map dependencies."
---

# Explorer Agent

Explore the codebase to understand structure and answer questions.

## Instructions
- Use Glob and Grep to find relevant files
- Read key files to understand architecture
- Map out dependencies and data flow
- Report findings concisely — focus on what matters for the task at hand
`;
}

function implementerAgent(): string {
  return `---
name: implementer
description: "Implements features, fixes bugs, and writes code following established patterns."
---

# Implementer Agent

Write code to implement features or fix bugs.

## Instructions
- Follow existing code patterns and conventions
- Write clean, readable code with appropriate comments
- Handle edge cases and error states
- Run build/lint/test commands to verify changes
- Create atomic, focused changes — one concern per implementation
`;
}

function reviewerAgent(): string {
  return `---
name: reviewer
description: "Reviews code changes for quality, correctness, and consistency."
---

# Reviewer Agent

Review code changes for quality and correctness.

## Instructions
- Check for bugs, edge cases, and security issues
- Verify consistency with existing patterns
- Ensure error handling is thorough
- Check that the implementation matches requirements
- Verify build passes and tests are adequate
`;
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'game',
    name: 'Game',
    description: 'Game designer, gameplay programmer, and QA tester. For Unity, Godot, Unreal, or web-based games.',
    icon: '\uD83C\uDFAE',
    color: 'var(--dm-epic-purple)',
    skills: [
      { name: 'game-designer', filename: 'SKILL.md', content: gameDesignerSkill() },
      { name: 'gameplay-programmer', filename: 'SKILL.md', content: gameplayProgrammerSkill() },
      { name: 'qa-tester', filename: 'SKILL.md', content: qaTesterSkill() },
    ],
    agents: [
      { name: 'explorer', filename: 'agent.md', content: explorerAgent() },
      { name: 'implementer', filename: 'agent.md', content: implementerAgent() },
      { name: 'reviewer', filename: 'agent.md', content: reviewerAgent() },
    ],
    epics: [
      { name: 'Core Mechanics', defaultTasks: ['Define core game loop', 'Implement player controller', 'Add basic physics/collision'] },
      { name: 'Content', defaultTasks: ['Design first level/scene', 'Create placeholder assets'] },
      { name: 'Polish', defaultTasks: ['Add UI/HUD', 'Sound effects and music', 'QA pass'] },
    ],
    scaffoldCommand: undefined,
  },
  {
    id: 'web',
    name: 'Web App',
    description: 'Senior frontend, backend, database, and UI/UX. For SaaS, dashboards, and web platforms.',
    icon: '\uD83C\uDF10',
    color: 'var(--dm-accent)',
    skills: [
      { name: 'senior-frontend', filename: 'SKILL.md', content: seniorFrontendSkill() },
      { name: 'backend-development', filename: 'SKILL.md', content: backendSkill() },
      { name: 'databases', filename: 'SKILL.md', content: databasesSkill() },
      { name: 'ui-ux-design', filename: 'SKILL.md', content: uiUxSkill() },
    ],
    agents: [
      { name: 'explorer', filename: 'agent.md', content: explorerAgent() },
      { name: 'implementer', filename: 'agent.md', content: implementerAgent() },
      { name: 'reviewer', filename: 'agent.md', content: reviewerAgent() },
    ],
    epics: [
      { name: 'Foundation', defaultTasks: ['Project setup and tooling', 'Database schema design', 'Auth flow'] },
      { name: 'Core Features', defaultTasks: ['Main dashboard/page', 'CRUD operations', 'API endpoints'] },
      { name: 'Polish', defaultTasks: ['Responsive design pass', 'Error handling', 'Performance optimization'] },
    ],
    scaffoldCommand: undefined,
  },
  {
    id: 'mobile',
    name: 'Mobile App',
    description: 'Mobile developer, UI/UX, and backend. For iOS, Android, React Native, or Flutter apps.',
    icon: '\uD83D\uDCF1',
    color: 'var(--dm-success)',
    skills: [
      { name: 'mobile-dev', filename: 'SKILL.md', content: mobileDevSkill() },
      { name: 'ui-ux-design', filename: 'SKILL.md', content: uiUxSkill() },
      { name: 'backend-development', filename: 'SKILL.md', content: backendSkill() },
    ],
    agents: [
      { name: 'explorer', filename: 'agent.md', content: explorerAgent() },
      { name: 'implementer', filename: 'agent.md', content: implementerAgent() },
      { name: 'reviewer', filename: 'agent.md', content: reviewerAgent() },
    ],
    epics: [
      { name: 'Setup', defaultTasks: ['Project scaffold', 'Navigation structure', 'Auth screens'] },
      { name: 'Core Screens', defaultTasks: ['Home screen', 'Detail screen', 'Profile/Settings'] },
      { name: 'Native Features', defaultTasks: ['Push notifications', 'Camera/media', 'Offline support'] },
    ],
    scaffoldCommand: undefined,
  },
];
