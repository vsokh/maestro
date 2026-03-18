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

  describe('injection payloads (properly escaped)', () => {
    it('backtick command execution is properly escaped', () => {
      // In PowerShell, backticks are the escape character — they get doubled
      const input = '`whoami`';
      expect(escapePS(input)).toBe('``whoami``');
    });

    it('PowerShell variable expansion is properly escaped', () => {
      // $env:USERNAME would expand to the current user in PS — $ gets backtick-prefixed
      const input = '$env:USERNAME';
      expect(escapePS(input)).toBe('`$env:USERNAME');
    });

    it('subexpression operator is properly escaped', () => {
      // $(Get-Process) would execute Get-Process in PS — $, (, ) all escaped
      const input = '$(Get-Process)';
      expect(escapePS(input)).toBe('`$`(Get-Process`)');
    });

    it('semicolon command chaining is properly escaped', () => {
      // ; would allow chaining a second command — gets backtick-prefixed
      const input = '; rm -rf /';
      expect(escapePS(input)).toBe('`; rm -rf /');
    });

    it('pipeline is properly escaped', () => {
      // | would pipe output to another command — gets backtick-prefixed
      const input = '| Out-File hack.txt';
      expect(escapePS(input)).toBe('`| Out-File hack.txt');
    });

    it('call operator is properly escaped', () => {
      // & is the call operator in PS — gets backtick-prefixed
      const input = '& calc.exe';
      expect(escapePS(input)).toBe('`& calc.exe');
    });
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

  describe('injection payloads (properly escaped)', () => {
    it('ampersand command chaining is properly escaped', () => {
      // & chains commands in cmd.exe — gets caret-prefixed
      const input = 'foo & del *';
      expect(escapeCmd(input)).toBe('foo ^& del *');
    });

    it('pipe redirection is properly escaped', () => {
      // | pipes output to another command — gets caret-prefixed
      const input = 'foo | net user';
      expect(escapeCmd(input)).toBe('foo ^| net user');
    });

    it('output redirect is properly escaped', () => {
      // > redirects output to a file — gets caret-prefixed
      const input = 'foo > hack.txt';
      expect(escapeCmd(input)).toBe('foo ^> hack.txt');
    });

    it('caret escape character is properly escaped', () => {
      // ^ is doubled first, then | is caret-prefixed: ^| → ^^| → ^^^|
      const input = 'foo ^| net user';
      expect(escapeCmd(input)).toBe('foo ^^^| net user');
    });

    it('percent variable is properly escaped', () => {
      // %USERPROFILE% would expand to an env variable in cmd — % gets doubled
      const input = '%USERPROFILE%';
      expect(escapeCmd(input)).toBe('%%USERPROFILE%%');
    });

    it('backtick in cmd context passes through unchanged', () => {
      // backticks have no special meaning in cmd — no escaping needed
      const input = 'foo `bar';
      expect(escapeCmd(input)).toBe('foo `bar');
    });
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
