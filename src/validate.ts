import type { StateData, ProgressEntry, QualityReport, QualityHistoryEntry } from './types';

const VALID_PROGRESS_STATUSES = ['in-progress', 'done', 'paused'] as const;

export function validateState(data: unknown): StateData | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const d = data as Record<string, unknown>;

  const tasks = Array.isArray(d.tasks)
    ? (d.tasks as Record<string, unknown>[]).filter(t =>
        t && typeof t === 'object' &&
        typeof t.id === 'number' && isFinite(t.id) &&
        typeof t.name === 'string'
      ).map(t => {
        if ('dependsOn' in t) {
          if (Array.isArray(t.dependsOn)) {
            const clean = (t.dependsOn as unknown[]).filter(dep => typeof dep === 'number' && isFinite(dep as number));
            return { ...t, dependsOn: clean.length > 0 ? clean : undefined };
          }
          const { dependsOn: _, ...rest } = t;
          return rest;
        }
        return t;
      })
    : [];

  const queue = Array.isArray(d.queue)
    ? (d.queue as Record<string, unknown>[]).filter(q =>
        q && typeof q === 'object' &&
        typeof q.task === 'number' && isFinite(q.task)
      )
    : [];

  const activity = Array.isArray(d.activity) ? d.activity : [];

  const taskNotes = (d.taskNotes && typeof d.taskNotes === 'object' && !Array.isArray(d.taskNotes))
    ? d.taskNotes
    : {};

  const epics = Array.isArray(d.epics) ? d.epics : [];

  const features = Array.isArray(d.features) ? d.features : [];

  return {
    ...d,
    tasks,
    queue,
    activity,
    taskNotes,
    epics,
    features,
  } as unknown as StateData;
}

export function validateProgress(data: unknown): ProgressEntry | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const d = data as Record<string, unknown>;

  if (typeof d.status !== 'string' || !(VALID_PROGRESS_STATUSES as readonly string[]).includes(d.status)) {
    return null;
  }

  const result: Record<string, unknown> = { status: d.status };

  if (typeof d.progress === 'string') result.progress = d.progress;
  if (typeof d.completedAt === 'string') result.completedAt = d.completedAt;
  if (typeof d.commitRef === 'string') result.commitRef = d.commitRef;
  if (typeof d.branch === 'string') result.branch = d.branch;
  if (typeof d.label === 'string') result.label = d.label;
  if (typeof d.filesChanged === 'number') result.filesChanged = d.filesChanged;

  return result as unknown as ProgressEntry;
}

export function validateQualityReport(data: unknown): QualityReport | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const d = data as Record<string, unknown>;

  if (typeof d.overallScore !== 'number' || !isFinite(d.overallScore)) return null;
  if (typeof d.grade !== 'string') return null;
  if (!d.dimensions || typeof d.dimensions !== 'object' || Array.isArray(d.dimensions)) return null;

  return data as QualityReport;
}

export function validateQualityHistory(data: unknown): QualityHistoryEntry[] {
  if (!Array.isArray(data)) return [];

  return data.filter(entry =>
    entry && typeof entry === 'object' &&
    typeof (entry as Record<string, unknown>).date === 'string' &&
    typeof (entry as Record<string, unknown>).overallScore === 'number' && isFinite((entry as Record<string, unknown>).overallScore as number)
  ) as QualityHistoryEntry[];
}
