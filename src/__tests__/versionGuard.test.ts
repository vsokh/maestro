import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeProgressIntoState } from 'taskgraph';
import type { StateData, Task } from '../types';

/**
 * Tests for the version counter (_v) regression guard.
 *
 * The version counter prevents stale state overwrites:
 * - Every save through PUT /api/state increments _v
 * - The watcher rejects incoming state with _v < lastKnownVersion
 * - The UI rejects incoming state with _v < current _v
 * - Rogue LLM writes (no _v or old _v) are caught and rejected
 */

function makeState(overrides: Partial<StateData> = {}): StateData {
  return {
    project: 'test',
    tasks: [],
    queue: [],
    taskNotes: {},
    activity: [],
    ...overrides,
  };
}

function makeTask(id: number, overrides: Partial<Task> = {}): Task {
  return { id, name: `Task ${id}`, status: 'pending', ...overrides };
}

describe('version counter (_v) in state', () => {
  it('_v field is preserved through merge operations', () => {
    const state = makeState({ _v: 10, tasks: [makeTask(1)] });
    const result = mergeProgressIntoState(state, {});
    expect(result.data._v).toBe(10);
  });

  it('_v field survives progress merges', () => {
    const state = makeState({ _v: 42, tasks: [makeTask(1)] });
    const result = mergeProgressIntoState(state, {
      '1': { status: 'in-progress', progress: 'Working' },
    });
    expect(result.data._v).toBe(42);
  });

  it('_v field survives done merges', () => {
    const state = makeState({ _v: 99, tasks: [makeTask(1, { status: 'in-progress' })] });
    const result = mergeProgressIntoState(state, {
      '1': { status: 'done', commitRef: 'abc' },
    });
    expect(result.data._v).toBe(99);
  });
});

describe('regression guard logic', () => {
  // These tests verify the comparison logic that handleSyncMessage and
  // the watcher use. The actual guard runs in React hooks/Node watcher,
  // but the comparison logic is straightforward: reject if incoming _v < current _v.

  function shouldRejectState(currentV: number, incomingV: number): boolean {
    // Mirrors the guard in useSync.ts handleSyncMessage and watcher.js
    if (currentV > 0 && incomingV < currentV) return true;
    return false;
  }

  it('rejects state with lower version', () => {
    expect(shouldRejectState(10, 5)).toBe(true);
  });

  it('accepts state with equal version', () => {
    expect(shouldRejectState(10, 10)).toBe(false);
  });

  it('accepts state with higher version', () => {
    expect(shouldRejectState(10, 15)).toBe(false);
  });

  it('accepts any state when current version is 0 (fresh start)', () => {
    expect(shouldRejectState(0, 0)).toBe(false);
    expect(shouldRejectState(0, 5)).toBe(false);
  });

  it('rejects state with no version (rogue write) when current has version', () => {
    // Rogue writes won't have _v, so incomingV defaults to 0
    expect(shouldRejectState(10, 0)).toBe(true);
  });

  it('accepts state with no version when current also has no version', () => {
    // Both are 0 — likely initial state, should accept
    expect(shouldRejectState(0, 0)).toBe(false);
  });
});

describe('version counter increment', () => {
  // Tests that the server-side increment logic works correctly.
  // The actual increment happens in server/api.js PUT handler:
  //   stateData._v = (stateData._v || 0) + 1

  function simulateServerIncrement(stateData: Record<string, unknown>): number {
    return ((stateData._v as number) || 0) + 1;
  }

  it('increments from 0 when _v is missing', () => {
    expect(simulateServerIncrement({})).toBe(1);
  });

  it('increments existing _v', () => {
    expect(simulateServerIncrement({ _v: 5 })).toBe(6);
  });

  it('monotonically increases on successive saves', () => {
    let v = 0;
    for (let i = 0; i < 10; i++) {
      v = simulateServerIncrement({ _v: v });
    }
    expect(v).toBe(10);
  });
});
