import { describe, it, expect } from 'vitest';

describe('taskgraph', () => {
  it('exports from barrel', async () => {
    const engine = await import('../src/index.js');
    expect(engine).toBeDefined();
  });
});
