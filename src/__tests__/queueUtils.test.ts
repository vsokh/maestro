import { describe, it, expect } from 'vitest';
import { escapePS, escapeCmd, shortTitle } from '../utils/queueUtils.ts';

describe('escapePS', () => {
  it('returns empty string for empty input', () => {
    expect(escapePS('')).toBe('');
  });

  it('returns unchanged string when no single quotes', () => {
    expect(escapePS('hello world')).toBe('hello world');
  });

  it('escapes single quotes by doubling them', () => {
    expect(escapePS("it's")).toBe("it''s");
  });

  it('escapes multiple single quotes', () => {
    expect(escapePS("'a' 'b'")).toBe("''a'' ''b''");
  });

  it('does not affect double quotes', () => {
    expect(escapePS('say "hello"')).toBe('say "hello"');
  });

  it('replaces newlines with spaces', () => {
    expect(escapePS("line1\nline2")).toBe("line1 line2");
  });

  it('handles carriage return + newline', () => {
    expect(escapePS("line1\r\nline2")).toBe("line1 line2");
  });
});

describe('escapeCmd', () => {
  it('returns empty string for empty input', () => {
    expect(escapeCmd('')).toBe('');
  });

  it('returns unchanged string when no double quotes', () => {
    expect(escapeCmd('hello world')).toBe('hello world');
  });

  it('escapes double quotes by doubling them', () => {
    expect(escapeCmd('say "hello"')).toBe('say ""hello""');
  });

  it('does not affect single quotes', () => {
    expect(escapeCmd("it's fine")).toBe("it's fine");
  });

  it('escapes percent signs', () => {
    expect(escapeCmd("100%")).toBe("100%%");
  });

  it('escapes percent signs in variable-like patterns', () => {
    expect(escapeCmd("%PATH%")).toBe("%%PATH%%");
  });

  it('replaces newlines with spaces', () => {
    expect(escapeCmd("line1\nline2")).toBe("line1 line2");
  });
});

describe('shortTitle', () => {
  it('returns first 2 significant words from basic name', () => {
    expect(shortTitle('Fix login button')).toBe('Fix login');
  });

  it('filters filler words', () => {
    expect(shortTitle('Add the login for my app')).toBe('Add login');
  });

  it('falls back to first 2 original words when all are filler', () => {
    expect(shortTitle('the a an')).toBe('the a');
  });

  it('returns the single word when only one significant word', () => {
    expect(shortTitle('Refactor')).toBe('Refactor');
  });

  it('returns empty string for empty input', () => {
    expect(shortTitle('')).toBe('');
  });

  it('takes first 2 significant words from a long name', () => {
    expect(shortTitle('Implement the new user authentication flow with OAuth')).toBe('Implement new');
  });
});
