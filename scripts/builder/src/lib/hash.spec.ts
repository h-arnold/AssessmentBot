import { describe, expect, it } from 'vitest';

import { checksumUtf8 } from './hash.js';

describe('checksumUtf8', () => {
  it('returns stable SHA-256 hashes for identical content', () => {
    const first = checksumUtf8('same-content');
    const second = checksumUtf8('same-content');

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns different hashes when content differs', () => {
    const baseline = checksumUtf8('content-a');
    const changed = checksumUtf8('content-b');

    expect(changed).not.toBe(baseline);
  });
});

