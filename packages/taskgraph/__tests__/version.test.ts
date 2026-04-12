import { describe, it, expect } from 'vitest';
import { isStaleVersion, incrementVersion } from '../src/state/version.js';
import type { StateData } from '../src/types.js';

describe('isStaleVersion', () => {
  it('returns true when incoming is older', () => {
    expect(isStaleVersion(5, 10)).toBe(true);
  });

  it('returns false when incoming is newer', () => {
    expect(isStaleVersion(10, 5)).toBe(false);
  });

  it('returns false when equal', () => {
    expect(isStaleVersion(5, 5)).toBe(false);
  });

  it('returns false when either is 0 (uninitialized)', () => {
    expect(isStaleVersion(0, 5)).toBe(false);
    expect(isStaleVersion(5, 0)).toBe(false);
  });
});

describe('incrementVersion', () => {
  it('increments _v from existing value', () => {
    const state = { _v: 5 } as StateData;
    const result = incrementVersion(state);
    expect(result._v).toBe(6);
  });

  it('starts from 1 when _v is undefined', () => {
    const state = {} as StateData;
    const result = incrementVersion(state);
    expect(result._v).toBe(1);
  });

  it('does not mutate input', () => {
    const state = { _v: 3 } as StateData;
    incrementVersion(state);
    expect(state._v).toBe(3);
  });
});
