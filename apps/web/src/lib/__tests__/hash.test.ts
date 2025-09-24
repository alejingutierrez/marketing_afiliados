import { describe, expect, it } from 'vitest';

import { sha256 } from '@/lib/hash';

describe('sha256 helper', () => {
  it('generates deterministic hashes', async () => {
    const first = await sha256('demo-value');
    const second = await sha256('demo-value');
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });
});
