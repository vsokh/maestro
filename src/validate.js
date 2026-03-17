/**
 * Runtime data validation for dev-manager.
 * Each function returns sanitized data or null if the input is fatally invalid.
 * Design: be defensive but not overly strict — apply defaults and filter bad
 * entries rather than rejecting entire structures when possible.
 */

const VALID_PROGRESS_STATUSES = ['in-progress', 'done', 'paused'];

/**
 * Validate state.json structure. Returns sanitized data or null.
 */
export function validateState(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const tasks = Array.isArray(data.tasks)
    ? data.tasks.filter(t =>
        t && typeof t === 'object' &&
        typeof t.id === 'number' && isFinite(t.id) &&
        typeof t.name === 'string'
      ).map(t => {
        // Sanitize dependsOn: must be array of finite numbers
        if ('dependsOn' in t) {
          if (Array.isArray(t.dependsOn)) {
            const clean = t.dependsOn.filter(d => typeof d === 'number' && isFinite(d));
            return { ...t, dependsOn: clean.length > 0 ? clean : undefined };
          }
          // dependsOn present but not an array — drop it
          const { dependsOn: _, ...rest } = t;
          return rest;
        }
        return t;
      })
    : [];

  const queue = Array.isArray(data.queue)
    ? data.queue.filter(q =>
        q && typeof q === 'object' &&
        typeof q.task === 'number' && isFinite(q.task)
      )
    : [];

  const activity = Array.isArray(data.activity) ? data.activity : [];

  const taskNotes = (data.taskNotes && typeof data.taskNotes === 'object' && !Array.isArray(data.taskNotes))
    ? data.taskNotes
    : {};

  const epics = Array.isArray(data.epics) ? data.epics : [];

  const features = Array.isArray(data.features) ? data.features : [];

  return {
    ...data,
    tasks,
    queue,
    activity,
    taskNotes,
    epics,
    features,
  };
}

/**
 * Validate a progress file entry. Returns sanitized data or null.
 */
export function validateProgress(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  if (typeof data.status !== 'string' || !VALID_PROGRESS_STATUSES.includes(data.status)) {
    return null;
  }

  const result = { status: data.status };

  if (typeof data.progress === 'string') result.progress = data.progress;
  if (typeof data.completedAt === 'string') result.completedAt = data.completedAt;
  if (typeof data.commitRef === 'string') result.commitRef = data.commitRef;
  if (typeof data.branch === 'string') result.branch = data.branch;
  if (typeof data.label === 'string') result.label = data.label;
  if (typeof data.filesChanged === 'number') result.filesChanged = data.filesChanged;

  return result;
}

/**
 * Validate quality report (latest.json). Returns data or null.
 */
export function validateQualityReport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  if (typeof data.overallScore !== 'number' || !isFinite(data.overallScore)) return null;
  if (typeof data.grade !== 'string') return null;
  if (!data.dimensions || typeof data.dimensions !== 'object' || Array.isArray(data.dimensions)) return null;

  return data;
}

/**
 * Validate quality history (history.json). Returns array (possibly empty).
 */
export function validateQualityHistory(data) {
  if (!Array.isArray(data)) return [];

  return data.filter(entry =>
    entry && typeof entry === 'object' &&
    typeof entry.date === 'string' &&
    typeof entry.overallScore === 'number' && isFinite(entry.overallScore)
  );
}
