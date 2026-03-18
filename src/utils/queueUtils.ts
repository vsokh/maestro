const FILLER_WORDS = new Set(['the','a','an','for','to','of','in','as','and','with','me','my','its','is','be']);

export function escapePS(s: string): string {
  return s.replace(/'/g, "''");
}

export function escapeCmd(s: string): string {
  return s.replace(/"/g, '""');
}

export function shortTitle(name: string): string {
  const words = name.split(/\s+/).filter(w => !FILLER_WORDS.has(w.toLowerCase()));
  return words.slice(0, 2).join(' ') || name.split(/\s+/).slice(0, 2).join(' ');
}
