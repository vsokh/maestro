export const DIM_KEYS = [
  'typeSafety', 'testQuality', 'errorHandling',
  'security', 'cleanArchitecture', 'domainLogic'
];

export const DIM_LABELS: Record<string, string> = {
  typeSafety: 'Type Safety',
  testQuality: 'Test Quality',
  errorHandling: 'Error Handling',
  security: 'Security',
  cleanArchitecture: 'Clean Architecture',
  domainLogic: 'Domain Logic',
};

export const DIM_SHORT: Record<string, string> = {
  typeSafety: 'Types',
  testQuality: 'Tests',
  errorHandling: 'Errors',
  security: 'Security',
  cleanArchitecture: 'Arch',
  domainLogic: 'Domain',
};

export const DIM_DESCRIPTIONS: Record<string, string> = {
  typeSafety: 'Can an agent understand data contracts without reading all the code? Measures type escape hatches, untyped external data, catch block typing, return type annotations.',
  testQuality: 'Can an agent verify its changes are correct? Measures coverage breadth, AAA compliance, error path coverage, behavior vs implementation testing.',
  errorHandling: 'Are failures visible? Can an agent debug issues? Measures mutation feedback, catch block quality, error boundaries, loading/error states.',
  security: 'Will an agent introduce vulnerabilities by following existing patterns? Measures input validation, auth patterns, injection vectors, secrets, dependency audit.',
  cleanArchitecture: 'Can an agent find where to make changes and follow existing structure? Measures function focus, SRP, nesting depth, dependency direction, style containment.',
  domainLogic: 'Are business rules correct and testable? Measures rule accuracy, edge case handling, rule consistency, derived state, testability.',
};

/** Maps old/renamed dimension keys to their current equivalents */
export const DIM_KEY_ALIASES: Record<string, string> = {
  testing: 'testQuality',
  componentArchitecture: 'cleanArchitecture',
};

/** Resolve a canonical dimension key to its value in a dimensions record,
 *  trying the key itself first, then any known alias (old key name). */
function resolveDim<T>(dims: Record<string, T> | undefined, key: string): T | undefined {
  if (!dims) return undefined;
  let val = dims[key];
  if (val === undefined) {
    const oldKey = Object.entries(DIM_KEY_ALIASES).find(([, v]) => v === key)?.[0];
    if (oldKey) val = dims[oldKey];
  }
  return val;
}

/** Get dimension score from a history entry, resolving aliases for old key names.
 *  Returns number or null if the dimension doesn't exist in the entry. */
export function getDimValue(
  dims: Record<string, { score: number } | number> | undefined,
  key: string
): number | null {
  const val = resolveDim(dims, key);
  if (val === undefined) return null;
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object') return val.score ?? null;
  return null;
}

/** Get the full dimension entry from a QualityReport, resolving aliases. */
export function getDimEntry<T>(dims: Record<string, T> | undefined, key: string): T | undefined {
  return resolveDim(dims, key);
}

export function scoreColor(s: number) {
  if (s >= 8) return 'var(--dm-success)';
  if (s >= 6) return 'var(--dm-accent)';
  if (s >= 4) return 'var(--dm-amber)';
  return 'var(--dm-danger)';
}

/** Score color for 0-100 scale (stability, gates) */
export function scoreColor100(s: number) {
  if (s >= 85) return 'var(--dm-success)';
  if (s >= 70) return 'var(--dm-accent)';
  if (s >= 50) return 'var(--dm-amber)';
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
