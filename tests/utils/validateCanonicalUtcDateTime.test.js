import { describe, expect, it } from 'vitest';

const { Validate } = require('#backend/Utils/Validate.js');
const {
  isIsoDateTimeString_,
} = require('#backend/z_Api/assignmentDefinition/assignmentDefinitionPartialRowValidation.js');

describe('Validate.isCanonicalUtcDateTime', () => {
  it.each(['2024-02-29T00:00:00.000Z', '2000-01-01T23:59:59.999Z', '2026-12-31T12:34:56.123Z'])(
    'accepts canonical UTC datetime %s',
    (value) => {
      expect(Validate.isCanonicalUtcDateTime?.(value)).toBe(true);
    }
  );

  it.each([
    '2024-01-01T00:00:00.000Z',
    '2024-12-31T23:59:59.999Z',
    '0000-02-29T00:00:00.000Z',
    '0100-02-28T00:00:00.000Z',
    '0400-02-29T00:00:00.000Z',
  ])('handles Gregorian and component boundaries for %s', (value) => {
    expect(Validate.isCanonicalUtcDateTime(value)).toBe(true);
  });

  it.each([
    '2023-02-29T00:00:00.000Z',
    '1900-02-29T00:00:00.000Z',
    '2024-04-31T00:00:00.000Z',
    '2024-01-01T24:00:00.000Z',
    '2024-01-01T23:60:00.000Z',
    '2024-01-01T23:59:60.000Z',
    '2024-01-01',
    '2024-01-01T00:00:00Z',
    '2024-01-01T00:00:00.00Z',
    '2024-01-01T00:00:00.000+00:00',
    '2024-01-01T00:00:00.000-05:00',
    '2024-01-01T00:00:00.000Z_0',
    '2024-00-01T00:00:00.000Z',
    '2024-13-01T00:00:00.000Z',
    '2024-01-01T25:00:00.000Z',
    '2024-01-01T00:60:00.000Z',
    '2024-01-01T00:00:60.000Z',
    '2024-01-00T00:00:00.000Z',
    '2024-01-32T00:00:00.000Z',
    new Date('2024-01-01T00:00:00.000Z'),
    null,
    undefined,
    0,
  ])('rejects non-canonical timestamp %s', (value) => {
    expect(Validate.isCanonicalUtcDateTime?.(value)).toBe(false);
  });

  it('preserves the API-owned ISO predicate and its broader offset acceptance', () => {
    expect(isIsoDateTimeString_('2024-01-01T00:00:00.000Z')).toBe(true);
    expect(isIsoDateTimeString_('2024-01-01T00:00:00.000+05:30')).toBe(true);
    expect(isIsoDateTimeString_('2024-02-30T00:00:00.000Z')).toBe(false);
  });
});
