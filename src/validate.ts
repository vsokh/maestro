// Core validators re-exported from engine
export { validateState, validateProgress } from 'taskgraph';

// Product-specific validators (depend on product types)
import type { QualityReport, QualityHistoryEntry } from './types';

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
