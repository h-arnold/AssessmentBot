import { describe, expect, it } from 'vitest';
const { ABClassMetadata } = require('#backend/Models/ABClassMetadata.js');

const scores = { completeness: 0, accuracy: 2.5, spag: 'N', overall: 'excluded' };
const classAverages = (updatedAt) => ({ ...scores, updatedAt });
const recent = (assignmentId, updatedAt, assignmentDefinitionKey = 'shared') => ({
  assignmentId,
  assignmentDefinitionKey,
  averages: { ...scores },
  updatedAt,
});
const metadata = (entries = [], timestamp = '2024-02-29T12:00:00.000Z') => ({
  classAverages: classAverages(timestamp),
  recentAssignments: entries,
});

function expectTypedFailure(Type, callback, path) {
  try {
    callback();
    throw new Error('Expected metadata validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(globalThis.ABClassMetadataValidationError);
    expect(error.fieldPath).toBe(path);
    expect(error.message).toContain(path);
    expect(error.inputSource).not.toBe('request');
    expect(error).not.toBeInstanceOf(globalThis.ApiValidationError);
  }
}

describe('ABClassMetadata canonical timestamps', () => {
  it.each([
    '0000-01-01T00:00:00.000Z',
    '0000-02-29T00:00:00.000Z',
    '0001-01-01T00:00:00.000Z',
    '0099-12-31T23:59:59.999Z',
    '0100-01-01T00:00:00.000Z',
    '2000-02-29T00:00:00.000Z',
    '9999-12-31T23:59:59.999Z',
  ])('accepts canonical calendar timestamp %s', (value) => {
    expect(Validate.isCanonicalUtcDateTime?.(value)).toBe(true);
  });

  it.each([
    '0001-02-29T00:00:00.000Z',
    '1900-02-29T00:00:00.000Z',
    '2024-00-01T00:00:00.000Z',
    '2024-13-01T00:00:00.000Z',
    '2024-01-00T00:00:00.000Z',
    '2024-01-32T00:00:00.000Z',
    '+010000-01-01T00:00:00.000Z',
    '2024-01-01T00:00:00.0000Z',
    '2024-01-01T00:00:00.000Zx',
    ' 2024-01-01T00:00:00.000Z',
    '2024-01-01T00:00:00.000Z ',
  ])('rejects non-canonical calendar timestamp %s', (value) => {
    expect(Validate.isCanonicalUtcDateTime?.(value)).toBe(false);
  });

  it.each([
    ['2024-02-30T12:00:00.000Z', 'metadata.classAverages.updatedAt'],
    [null, 'metadata.classAverages.updatedAt'],
    [undefined, 'metadata.classAverages.updatedAt'],
    [new Date('2024-02-29T12:00:00.000Z'), 'metadata.classAverages.updatedAt'],
  ])('rejects invalid class timestamp %s with a typed domain path', (value, path) => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    expectTypedFailure(
      Type,
      () => Type.validateClassAverages(classAverages(value), 'metadata.classAverages'),
      path
    );
  });

  it.each([
    ['2024-02-30T12:00:00.000Z', 'metadata.recentAssignments[0].updatedAt'],
    ['2024-02-29T12:00:00.000+00:00', 'metadata.recentAssignments[0].updatedAt'],
    [null, 'metadata.recentAssignments[0].updatedAt'],
    [undefined, 'metadata.recentAssignments[0].updatedAt'],
  ])('rejects invalid entry timestamp %s with a typed domain path', (value, path) => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    expectTypedFailure(
      Type,
      () => Type.validateRecentAssignment(recent('id', value), 'metadata.recentAssignments[0]'),
      path
    );
  });

  it('preserves accepted timestamp values without normalising or stamping them', () => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    const original = '0001-01-01T00:00:00.000Z';
    const value = classAverages(original);
    Type.validateClassAverages(value, 'metadata.classAverages');
    expect(value.updatedAt).toBe(original);
  });
});

describe('ABClassMetadata recent-assignment ordering', () => {
  it.each([0, 1, 2, 3])('accepts dense recent arrays of length %i', (length) => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    const entries = Array.from({ length }, (_, index) =>
      recent(`opaque-${index}`, `2024-02-2${9 - index}T12:00:00.000Z`)
    );
    expect(() => Type.validateMetadata(metadata(entries), 'metadata')).not.toThrow();
  });

  it('accepts unequal descending timestamps, opaque identifiers, reusable keys, and independent summary time', () => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    const entries = [
      recent('z / opaque', '2024-02-29T12:00:00.000Z'),
      recent('007', '2024-02-28T12:00:00.000Z'),
    ];
    expect(() =>
      Type.validateMetadata(metadata(entries, '0001-01-01T00:00:00.000Z'), 'metadata')
    ).not.toThrow();
    expect(() =>
      Type.validateMetadata(metadata(entries, '9999-12-31T23:59:59.999Z'), 'metadata')
    ).not.toThrow();
  });

  it('preserves reverse-lexical caller order for equal timestamps', () => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    const entries = [
      recent('z', '2024-02-29T12:00:00.000Z'),
      recent('a', '2024-02-29T12:00:00.000Z'),
    ];
    const value = metadata(entries);
    const before = structuredClone(value);
    Type.validateMetadata(value, 'metadata');
    expect(value.recentAssignments.map(({ assignmentId }) => assignmentId)).toEqual(['z', 'a']);
    expect(value).toStrictEqual(before);
  });

  it.each(['assignmentId', 'assignmentDefinitionKey'])(
    'rejects invalid %s values without repair',
    (field) => {
      const Type = ABClassMetadata;
      expect(typeof Type).toBe('function');
      for (const invalid of ['', ' ', ' id ', 7, null, undefined]) {
        const entries = [recent('valid', '2024-02-29T12:00:00.000Z')];
        entries[0][field] = invalid;
        const value = metadata(entries);
        const before = structuredClone(value);
        expect(() => Type.validateMetadata(value, 'metadata')).toThrow();
        expect(value).toStrictEqual(before);
      }
    }
  );

  it('rejects malformed lists without sorting, dropping, or rewriting their inputs', () => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    const badLists = [
      [recent('older', '2024-02-28T12:00:00.000Z'), recent('newer', '2024-02-29T12:00:00.000Z')],
      [recent('same', '2024-02-29T12:00:00.000Z'), recent('same', '2024-02-28T12:00:00.000Z')],
      [
        recent('1', '2024-02-29T12:00:00.000Z'),
        recent('2', '2024-02-28T12:00:00.000Z'),
        recent('3', '2024-02-27T12:00:00.000Z'),
        recent('4', '2024-02-26T12:00:00.000Z'),
      ],
      [null],
      [undefined],
      [{ assignmentId: 'incomplete' }],
    ];
    const sparse = [];
    sparse.length = 1;
    badLists.push(sparse);
    for (const entries of badLists) {
      const value = metadata(entries);
      const before = structuredClone(value);
      expect(() => Type.validateMetadata(value, 'metadata')).toThrow();
      expect(value).toStrictEqual(before);
    }
    for (const notArray of [null, {}, '']) {
      const value = metadata();
      value.recentAssignments = notArray;
      expect(() => Type.validateMetadata(value, 'metadata')).toThrow();
      expect(value.recentAssignments).toBe(notArray);
    }
  });
});
