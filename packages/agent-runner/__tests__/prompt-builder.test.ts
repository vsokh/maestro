import { describe, it, expect } from 'vitest';
import { buildClaudePrompt, DEFAULT_ENGINES } from '../src/prompt-builder.js';

describe('buildClaudePrompt', () => {
  it('translates /orchestrator task N', () => {
    const prompt = buildClaudePrompt('/orchestrator task 42');
    expect(prompt).toContain('task #42');
    expect(prompt).toContain('progress/42.json');
    expect(prompt).toContain('headless execution');
    expect(prompt).toContain('DO NOT WRITE TO .maestro/state.json');
  });

  it('translates /codehealth', () => {
    const prompt = buildClaudePrompt('/codehealth scan');
    expect(prompt).toContain('codehealth skill');
    expect(prompt).toContain('quality/latest.json');
  });

  it('translates /autofix', () => {
    const prompt = buildClaudePrompt('/autofix');
    expect(prompt).toContain('autofix skill');
    expect(prompt).toContain('backlog.json');
  });

  it('translates /orchestrator arrange', () => {
    const prompt = buildClaudePrompt('/orchestrator arrange');
    expect(prompt).toContain('dependency graph');
    expect(prompt).toContain('progress/arrange.json');
  });

  it('passes unknown commands through with headless suffix', () => {
    const prompt = buildClaudePrompt('do something custom');
    expect(prompt).toContain('do something custom');
    expect(prompt).toContain('headless execution');
  });
});

describe('DEFAULT_ENGINES', () => {
  it('has claude, codex, cursor', () => {
    expect(Object.keys(DEFAULT_ENGINES).sort()).toEqual(['claude', 'codex', 'cursor']);
  });

  it('claude uses --dangerously-skip-permissions -p', () => {
    const { cmd, args } = DEFAULT_ENGINES.claude('/orchestrator task 1');
    expect(cmd).toBe('claude');
    expect(args[0]).toBe('--dangerously-skip-permissions');
    expect(args[1]).toBe('-p');
    expect(typeof args[2]).toBe('string');
  });

  it('codex uses exec', () => {
    const { cmd, args } = DEFAULT_ENGINES.codex('some command');
    expect(cmd).toBe('codex');
    expect(args).toEqual(['exec', 'some command']);
  });

  it('cursor uses -p', () => {
    const { cmd, args } = DEFAULT_ENGINES.cursor('some command');
    expect(cmd).toBe('cursor-agent');
    expect(args).toEqual(['-p', 'some command']);
  });
});
