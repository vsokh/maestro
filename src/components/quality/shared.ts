export const DIM_KEYS = [
  'typeSafety', 'componentArchitecture', 'errorHandling', 'testing',
  'cssDesignSystem', 'i18nCompleteness', 'accessibility', 'security',
  'performance', 'devopsBuildHealth'
];

export const DIM_LABELS: Record<string, string> = {
  typeSafety: 'Type Safety',
  componentArchitecture: 'Architecture',
  errorHandling: 'Error Handling',
  testing: 'Testing',
  cssDesignSystem: 'CSS / Design',
  i18nCompleteness: 'i18n',
  accessibility: 'Accessibility',
  security: 'Security',
  performance: 'Performance',
  devopsBuildHealth: 'DevOps'
};

export const DIM_SHORT: Record<string, string> = {
  typeSafety: 'Types',
  componentArchitecture: 'Arch',
  errorHandling: 'Errors',
  testing: 'Tests',
  cssDesignSystem: 'CSS',
  i18nCompleteness: 'i18n',
  accessibility: 'a11y',
  security: 'Security',
  performance: 'Perf',
  devopsBuildHealth: 'DevOps'
};

export const DIM_DESCRIPTIONS: Record<string, string> = {
  typeSafety: 'Strict TypeScript usage — no `any` types, typed Supabase rows, proper error narrowing with `unknown`. Measures how much the compiler can catch before runtime.',
  componentArchitecture: 'Component size and separation of concerns — files under 400 LOC, single responsibility, extracted subcomponents with typed props. God components score low.',
  errorHandling: 'User-facing feedback for all mutations — no silent catch blocks, toast notifications on success/failure, disabled buttons during pending, ErrorBoundary coverage.',
  testing: 'Test coverage breadth — unit tests for utils/hooks, render smoke tests for every page, error path coverage, shared test helpers. Measured by test count and scope.',
  cssDesignSystem: 'Design system discipline — CSS variables over hardcoded hex, minimal inline styles, no unused selectors, consistent token usage across all components.',
  i18nCompleteness: 'Translation coverage — all UI strings in i18n system with both languages, no hardcoded Cyrillic/English in components, consistent key naming.',
  accessibility: 'WCAG 2.1 AA compliance — semantic HTML, keyboard navigation, ARIA labels, focus traps in modals, translated screen reader text, no div-onClick without keyboard handler.',
  security: 'Row Level Security on all tables, no hardcoded secrets, XSS-safe rendering, auth token handling, file upload validation, dependency audit.',
  performance: 'Bundle size, memoization of expensive computations, code splitting, lazy loading of dev-only code, no unnecessary re-renders in heavy components.',
  devopsBuildHealth: 'Build reliability — zero type errors, zero lint errors, CI/CD pipeline, automated tests, preview deploys. Measures infrastructure confidence.',
};

export function scoreColor(s: number) {
  if (s >= 8) return 'var(--dm-success)';
  if (s >= 6) return 'var(--dm-accent)';
  if (s >= 4) return 'var(--dm-amber)';
  return 'var(--dm-danger)';
}

export function gradeClass(g: string) {
  if (g.startsWith('A')) return 'var(--dm-success)';
  if (g.startsWith('B')) return 'var(--dm-accent)';
  if (g.startsWith('C')) return 'var(--dm-amber)';
  return 'var(--dm-danger)';
}

export function trendFromScores(current: number, previous: number | null) {
  if (previous == null) return 'baseline';
  const diff = current - previous;
  if (diff >= 1) return 'up';
  if (diff <= -1) return 'down';
  return 'stable';
}
