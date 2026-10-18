import { describe, expect, it } from 'vitest';
const { ABClassMetadata } = require('#backend/Models/ABClassMetadata.js');

const at = '2024-02-29T12:34:56.789Z';
const scores = (value = 0) => ({
  completeness: value,
  accuracy: value,
  spag: value,
  overall: value,
});
const classAverages = (value = 0) => ({ ...scores(value), updatedAt: at });
const entry = (id, updatedAt = at, definitionKey = 'shared') => ({
  assignmentId: id,
  assignmentDefinitionKey: definitionKey,
  averages: scores(2.5),
  updatedAt,
});
const metadata = (entries = []) => ({
  classAverages: classAverages(4.5),
  recentAssignments: entries,
});

describe('ABClassMetadata validation', () => {
  it('loads as a domain owner without requiring compatibility globals', () => {
    expect(ABClassMetadata).toBeTypeOf('function');
  });

  it.each([0, 5, 2.75, 'N', 'E', 'excluded'])('accepts exact average score %s', (value) => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    expect(Type.validateAverageScore(value, 'score')).toBeUndefined();
  });

  it.each([
    -0.01,
    5.01,
    Infinity,
    -Infinity,
    NaN,
    '0',
    '2.5',
    true,
    false,
    'n',
    'e',
    'EXCLUDED',
    null,
  ])('rejects score without coercion: %s', (value) => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    expect(() => Type.validateAverageScore(value, 'metadata.classAverages.overall')).toThrow();
  });

  it('accepts ordinary and null-prototype exact records and mixed metric markers', () => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    const nullPrototypeScores = Object.assign(Object.create(null), {
      completeness: 0,
      accuracy: 'N',
      spag: 'E',
      overall: 'excluded',
    });
    expect(() => Type.validateAverageScores(nullPrototypeScores, 'averages')).not.toThrow();
    expect(() => Type.validateAverageScores(scores(5), 'averages')).not.toThrow();
    expect(() => Type.validateClassAverages(classAverages(), 'classAverages')).not.toThrow();
    expect(() => Type.validateMetadata(metadata(), 'metadata')).not.toThrow();
  });

  it.each([
    [
      () => ({ ...scores(), completeness: undefined }),
      'validateAverageScores',
      'averages',
      'averages.completeness',
    ],
    [
      () => ({ ...scores(), surprise: 1 }),
      'validateAverageScores',
      'averages',
      'averages.surprise',
    ],
    [
      () => ({ ...scores(), updatedAt: at }),
      'validateAverageScores',
      'metadata.classAverages',
      'metadata.classAverages.updatedAt',
    ],
    [() => [], 'validateAverageScores', 'metadata.classAverages', 'metadata.classAverages'],
    [() => new Date(), 'validateAverageScores', 'metadata.classAverages', 'metadata.classAverages'],
    [
      () =>
        new (class Scores {
          constructor() {
            Object.assign(this, scores());
          }
        })(),
      'validateAverageScores',
      'metadata.classAverages',
      'metadata.classAverages',
    ],
    [
      () => Object.defineProperty(scores(), 'hidden', { value: true }),
      'validateAverageScores',
      'metadata.classAverages',
      'metadata.classAverages.hidden',
    ],
    [
      () => Object.assign(scores(), { [Symbol('unexpected')]: true }),
      'validateAverageScores',
      'metadata.classAverages',
      'metadata.classAverages',
    ],
    [
      () => ({ ...classAverages(), lastAssessedAt: at }),
      'validateClassAverages',
      'metadata.classAverages',
      'metadata.classAverages.lastAssessedAt',
    ],
    [
      () => ({ ...entry('a'), extra: true }),
      'validateRecentAssignment',
      'metadata.recentAssignments[0]',
      'metadata.recentAssignments[0].extra',
    ],
    [() => Object.create({ completeness: 1 }), 'validateAverageScores', 'averages', 'averages'],
  ])(
    'rejects malformed records with an actionable path',
    (makeValue, validatorName, context, expectedPath) => {
      const Type = ABClassMetadata;
      expect(typeof Type).toBe('function');
      const value = makeValue();
      const validator = Type[validatorName];
      try {
        validator(value, context);
        throw new Error('expected validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(globalThis.ABClassMetadataValidationError);
        expect(error.fieldPath).toBe(expectedPath);
        expect(error.message).toContain(error.fieldPath);
        expect(error.inputSource).not.toBe('request');
        expect(error).not.toBeInstanceOf(globalThis.ApiValidationError);
      }
    }
  );

  it('directly validates recent entries and rejects unexpected own keys of every property kind', () => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    expect(() =>
      Type.validateRecentAssignment(entry('opaque'), 'recentAssignments[0]')
    ).not.toThrow();
    const cases = [
      [
        Type.validateAverageScores,
        scores(),
        'hidden',
        (value) => Object.defineProperty(value, 'hidden', { value: true }),
      ],
      [
        Type.validateAverageScores,
        scores(),
        'symbol',
        (value) => Object.defineProperty(value, Symbol('extra'), { value: true }),
      ],
      [
        Type.validateClassAverages,
        classAverages(),
        'lastAssessedAt',
        (value) => {
          value.lastAssessedAt = at;
        },
      ],
      [
        Type.validateRecentAssignment,
        entry('id'),
        'extra',
        (value) => {
          value.extra = true;
        },
      ],
      [
        Type.validateMetadata,
        metadata(),
        'extra',
        (value) => {
          value.extra = true;
        },
      ],
    ];
    for (const [validator, value, path, addExtra] of cases) {
      addExtra(value);
      try {
        validator(value, 'metadata');
        throw new Error('expected domain validation failure');
      } catch (error) {
        expect(error).toBeInstanceOf(globalThis.ABClassMetadataValidationError);
        expect(error.fieldPath).toContain(path === 'symbol' ? 'metadata' : path);
        expect(error.message).toContain(error.fieldPath);
        expect(error.inputSource).not.toBe('request');
      }
    }
  });

  it('accepts null-prototype records at each domain record level', () => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    const nullRecord = (value) => Object.assign(Object.create(null), value);
    const nullScores = nullRecord(scores());
    const nullClassAverages = nullRecord({ ...classAverages() });
    const nullEntry = nullRecord({ ...entry('opaque'), averages: nullScores });
    const nullMetadata = nullRecord({
      classAverages: nullClassAverages,
      recentAssignments: [nullEntry],
    });
    for (const [validator, value] of [
      [Type.validateAverageScores, nullScores],
      [Type.validateClassAverages, nullClassAverages],
      [Type.validateRecentAssignment, nullEntry],
      [Type.validateMetadata, nullMetadata],
    ])
      expect(() => validator(value, 'metadata')).not.toThrow();
  });

  it('rejects absent and inherited required fields, disallowed records, and misplaced nulls', () => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    const bad = [
      [Type.validateAverageScores, { accuracy: 1, spag: 1, overall: 1 }, 'completeness'],
      [Type.validateClassAverages, { ...classAverages(), updatedAt: undefined }, 'updatedAt'],
      [Type.validateRecentAssignment, { ...entry('x'), assignmentId: undefined }, 'assignmentId'],
      [Type.validateMetadata, { classAverages: null, recentAssignments: [] }, 'classAverages'],
      [
        Type.validateMetadata,
        { classAverages: classAverages(), recentAssignments: [null] },
        'recentAssignments[0]',
      ],
      [Type.validateRecentAssignment, { ...entry('x'), averages: null }, 'averages'],
    ];
    for (const [validator, value, path] of bad) {
      try {
        validator(value, 'metadata');
        throw new Error('expected domain validation failure');
      } catch (error) {
        expect(error).toBeInstanceOf(globalThis.ABClassMetadataValidationError);
        expect(error.fieldPath).toContain(path);
        expect(error.message).toContain(error.fieldPath);
        expect(error.inputSource).not.toBe('request');
      }
    }
  });

  it('requires complete metadata and rejects misplaced null or nested undefined', () => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    for (const value of [
      undefined,
      {},
      { classAverages: null, recentAssignments: [] },
      { classAverages: classAverages(), recentAssignments: null },
      { classAverages: { ...classAverages(), overall: undefined }, recentAssignments: [] },
    ]) {
      expect(() => Type.validateMetadata(value, 'metadata')).toThrow();
    }
    expect(() => Type.validateMetadata(null, 'metadata')).not.toThrow();
  });

  it('reports nested failures with actionable metadata paths', () => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    const invalid = metadata([entry('one')]);
    invalid.recentAssignments[0].averages.overall = undefined;
    try {
      Type.validateMetadata(invalid, 'metadata');
      throw new Error('expected validation to fail');
    } catch (error) {
      expect(error.fieldPath ?? error.message).toContain('recentAssignments[0].averages.overall');
    }
  });

  it('uses typed path-bearing integrity errors at every direct validator and constructor boundary', () => {
    const Type = ABClassMetadata;
    const ErrorType = globalThis.ABClassMetadataValidationError;
    expect(typeof Type).toBe('function');
    const invalids = [
      [
        () => Type.validateAverageScore(-1, 'metadata.classAverages.overall'),
        'metadata.classAverages.overall',
      ],
      [
        () => Type.validateAverageScores({ ...scores(), overall: -1 }, 'metadata.classAverages'),
        'metadata.classAverages.overall',
      ],
      [
        () =>
          Type.validateClassAverages({ ...classAverages(), overall: -1 }, 'metadata.classAverages'),
        'metadata.classAverages.overall',
      ],
      [
        () =>
          Type.validateRecentAssignment(
            { ...entry('id'), averages: { ...scores(), accuracy: 8 } },
            'metadata.recentAssignments[0]'
          ),
        'metadata.recentAssignments[0].averages.accuracy',
      ],
      [
        () => Type.validateMetadata(metadata([entry('id'), entry('id')])),
        'metadata.recentAssignments[1].assignmentId',
      ],
      [() => new Type(undefined), 'metadata'],
    ];
    for (const [invoke, path] of invalids) {
      try {
        invoke();
        throw new Error('expected validation failure');
      } catch (error) {
        expect(error).toBeInstanceOf(ErrorType);
        expect(error.fieldPath).toBe(path);
        expect(error.message).toContain(path);
        expect(error.inputSource).not.toBe('request');
        expect(error).not.toBeInstanceOf(globalThis.ApiValidationError);
      }
    }
  });

  it('accepts at most three dense entries, allows repeated definition keys and equal timestamps in input order', () => {
    const Type = ABClassMetadata;
    expect(typeof Type).toBe('function');
    const equalTime = metadata([entry('first'), entry('second')]);
    expect(() => Type.validateMetadata(equalTime, 'metadata')).not.toThrow();
    expect(() =>
      Type.validateMetadata(metadata([entry('1'), entry('2'), entry('3')]), 'metadata')
    ).not.toThrow();
    for (const recentAssignments of [
      [entry('1'), entry('2'), entry('3'), entry('4')],
      [entry('same'), entry('same')],
      [entry('newer', '2024-02-29T12:34:56.789Z'), entry('older', '2024-02-29T12:34:57.789Z')],
      [entry('blank', at, ' ')],
      [entry('untrimmed', at, ' key ')],
      [entry('number', at, 42)],
      [undefined],
    ])
      expect(() => Type.validateMetadata(metadata(recentAssignments), 'metadata')).toThrow();
    const sparse = [];
    sparse.length = 1;
    expect(() => Type.validateMetadata(metadata(sparse), 'metadata')).toThrow();
  });
});
