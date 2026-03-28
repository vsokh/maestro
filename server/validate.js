const VALID_PROGRESS_STATUSES = ['in-progress', 'done', 'paused'];

/**
 * Validate a progress entry from a JSON file.
 * Returns a clean object or null if invalid.
 */
export function validateProgressEntry(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  if (typeof data.status !== 'string' || !VALID_PROGRESS_STATUSES.includes(data.status)) {
    return null;
  }

  const entry = { status: data.status };
  if (typeof data.progress === 'string') entry.progress = data.progress;
  if (typeof data.completedAt === 'string') entry.completedAt = data.completedAt;
  if (typeof data.commitRef === 'string') entry.commitRef = data.commitRef;
  if (typeof data.branch === 'string') entry.branch = data.branch;
  if (typeof data.label === 'string') entry.label = data.label;
  if (typeof data.filesChanged === 'number' && isFinite(data.filesChanged)) entry.filesChanged = data.filesChanged;
  if (Array.isArray(data.changes)) entry.changes = data.changes;
  if (typeof data.summary === 'string') entry.summary = data.summary;
  if (data.taskUpdates && typeof data.taskUpdates === 'object') entry.taskUpdates = data.taskUpdates;
  return entry;
}

/**
 * Validate basic state structure for PUT /api/state.
 * Returns true if the data has required fields and sound structure.
 * Individual malformed tasks don't reject the whole state,
 * but the top-level shape must be correct.
 */
export function validateStateStructure(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (!Array.isArray(data.tasks)) return false;

  // Every task must have numeric id, string name, string status
  for (const task of data.tasks) {
    if (!task || typeof task !== 'object' || Array.isArray(task)) return false;
    if (typeof task.id !== 'number' || !isFinite(task.id)) return false;
    if (typeof task.name !== 'string') return false;
    if (typeof task.status !== 'string') return false;
  }

  // Optional arrays — if present, must actually be arrays
  if (data.queue !== undefined && !Array.isArray(data.queue)) return false;
  if (data.activity !== undefined && !Array.isArray(data.activity)) return false;
  if (data.epics !== undefined && !Array.isArray(data.epics)) return false;

  return true;
}
