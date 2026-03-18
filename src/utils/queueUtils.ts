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
