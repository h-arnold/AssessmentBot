import { describe, expect, it } from 'vitest';
import { formatUpdatedAtLabel } from './dateFormatting';

describe('formatUpdatedAtLabel', () => {
  it('formats a valid ISO timestamp as en-GB date', () => {
    const result = formatUpdatedAtLabel('2025-05-15T12:00:00.000Z');
    expect(result).toBe('15/05/2025');
  });

  it('returns the em-dash fallback for null input', () => {
    expect(formatUpdatedAtLabel(null)).toBe('—');
  });

  it('returns the em-dash fallback for an unparseable ISO string', () => {
    expect(formatUpdatedAtLabel('not-a-date')).toBe('—');
  });
});
