const FILLER_WORDS = new Set(['the','a','an','for','to','of','in','as','and','with','me','my','its','is','be']);

export function escapePS(s: string): string {
  return s
    .replace(/`/g, '``')           // backtick (PS escape char) — double it first
    .replace(/\$/g, '`$')          // variable expansion
    .replace(/;/g, '`;')           // statement separator
    .replace(/\|/g, '`|')          // pipeline
    .replace(/&/g, '`&')           // call operator
    .replace(/\(/g, '`(')          // subexpression open
    .replace(/\)/g, '`)')          // subexpression close
    .replace(/'/g, "''")           // single quote (for single-quoted strings)
    .replace(/[\r\n]+/g, ' ');     // newlines
}

export function escapeCmd(s: string): string {
  return s
    .replace(/\^/g, '^^')         // caret (CMD escape char) — double it first
    .replace(/&/g, '^&')          // command separator
    .replace(/\|/g, '^|')         // pipeline
    .replace(/>/g, '^>')          // output redirect
    .replace(/</g, '^<')          // input redirect
    .replace(/"/g, '""')          // double quote
    .replace(/%/g, '%%')          // percent (env var expansion)
    .replace(/[\r\n]+/g, ' ');    // newlines
}

export function shortTitle(name: string): string {
  const words = name.split(/\s+/).filter(w => !FILLER_WORDS.has(w.toLowerCase()));
  return words.slice(0, 2).join(' ') || name.split(/\s+/).slice(0, 2).join(' ');
}

/**
 * Build a Windows Terminal command that arranges panes in an even grid.
 *
 * Uses sqrt-based grid dimensions so pane counts scale naturally:
 *   1 → full screen         5 → 3+2        9  → 3+3+3
 *   2 → 2 columns           6 → 3+3        10 → 4+3+3
 *   3 → 3 columns           7 → 3+2+2      12 → 4+4+4
 *   4 → 2×2                 8 → 3+3+2
 *
 * Extra panes go to the top rows so the widest (fewest-column) rows
 * sit at the bottom where the eye rests.
 */
export function buildGridLayout(paneArgs: string[]): string {
  const n = paneArgs.length;
  if (n === 0) return '';
  if (n === 1) return `new-tab ${paneArgs[0]}`;

  // 2–3 panes: single row
  if (n <= 3) {
    const parts = [`new-tab ${paneArgs[0]}`];
    for (let k = 1; k < n; k++) {
      const remaining = n - k;
      const size = remaining > 1 ? ` --size ${(remaining / (remaining + 1)).toFixed(2)}` : '';
      parts.push(`split-pane -V${size} ${paneArgs[k]}`);
    }
    return parts.join(' ; ');
  }

  // 4+ panes: compute grid dimensions
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);

  // Distribute panes evenly — top rows get the extras
  const base = Math.floor(n / rows);
  const extra = n % rows;
  const rowCounts: number[] = [];
  for (let r = 0; r < rows; r++) {
    rowCounts.push(r < extra ? base + 1 : base);
  }

  // Map row → pane indices
  const rowPanes: number[][] = [];
  let idx = 0;
  for (const count of rowCounts) {
    const row: number[] = [];
    for (let c = 0; c < count; c++) row.push(idx++);
    rowPanes.push(row);
  }

  const parts: string[] = [];

  // First pane fills the whole window
  parts.push(`new-tab ${paneArgs[rowPanes[0][0]]}`);

  // Create horizontal splits to establish rows (top → bottom)
  // Row heights are proportional to column count so every pane gets equal area.
  // E.g. 5 panes (3+2): top row 60% height, bottom 40% → each pane = 20%.
  for (let r = 1; r < rows; r++) {
    const sumBelow = rowCounts.slice(r).reduce((a, b) => a + b, 0);
    const sumFromHere = rowCounts.slice(r - 1).reduce((a, b) => a + b, 0);
    const size = (sumBelow / sumFromHere).toFixed(2);
    parts.push(`split-pane -H --size ${size} ${paneArgs[rowPanes[r][0]]}`);
  }

  // Build each row's columns from bottom → top
  // (focus lands on the last row after the H-splits above)
  for (let r = rows - 1; r >= 0; r--) {
    const indices = rowPanes[r];
    for (let c = 1; c < indices.length; c++) {
      const remaining = indices.length - c;
      const size = remaining > 1 ? ` --size ${(remaining / (remaining + 1)).toFixed(2)}` : '';
      parts.push(`split-pane -V${size} ${paneArgs[indices[c]]}`);
    }
    if (r > 0) parts.push('move-focus -d up');
  }

  return parts.join(' ; ');
}
