import type { StateData } from '../types.js';

/**
 * Returns true if the incoming version is stale (older than current).
 * Used to reject rogue state writes from LLMs or outdated clients.
 */
export function isStaleVersion(incomingV: number, currentV: number): boolean {
  return currentV > 0 && incomingV > 0 && incomingV < currentV;
}

/**
 * Increments the version counter on state data.
 * Used before writing state to disk.
 */
export function incrementVersion(state: StateData): StateData {
  return { ...state, _v: ((state._v || 0) + 1) };
}
