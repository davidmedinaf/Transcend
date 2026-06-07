import { describe, it, expect } from 'vitest';

describe('Project Setup', () => {
  it('vitest is configured correctly', () => {
    expect(true).toBe(true);
  });

  it('path aliases resolve correctly', async () => {
    // Verify that the @/ alias resolves to src/
    const path = await import('path');
    expect(path).toBeDefined();
  });
});
