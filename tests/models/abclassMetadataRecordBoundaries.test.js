import { describe, expect, it } from 'vitest';
const { ABClassMetadata } = require('#backend/Models/ABClassMetadata.js');
const time = '2024-02-29T12:34:56.789Z';
const scores = () => ({ completeness: 2, accuracy: 2, spag: 2, overall: 2 });
const classAverages = () => ({ ...scores(), updatedAt: time });
const entry = () => ({
  assignmentId: 'id',
  assignmentDefinitionKey: 'key',
  averages: scores(),
  updatedAt: time,
});
const metadata = () => ({ classAverages: classAverages(), recentAssignments: [entry()] });

function expectDomainFailure(invoke, path) {
  try {
    invoke();
    throw new Error('Expected metadata validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(globalThis.ABClassMetadataValidationError);
    expect(error.fieldPath).toBe(path);
    expect(error.message).toContain(path);
    expect(error.inputSource).not.toBe('request');
    expect(error).not.toBeInstanceOf(globalThis.ApiValidationError);
  }
}

describe('ABClassMetadata record boundaries', () => {
  it('rejects disallowed record types at each required shape', () => {
    const Type = ABClassMetadata;
    const records = [
      [Type.validateAverageScores, () => scores(), 'averages'],
      [Type.validateClassAverages, () => classAverages(), 'metadata.classAverages'],
      [Type.validateRecentAssignment, () => entry(), 'metadata.recentAssignments[0]'],
      [Type.validateMetadata, () => metadata(), 'metadata'],
    ];
    for (const [validator, makeRecord, path] of records) {
      const invalidValues = [
        [],
        new Date(),
        new (class Record {
          constructor() {
            Object.assign(this, makeRecord());
          }
        })(),
        Object.create({ ...makeRecord() }),
      ];
      for (const value of invalidValues) expectDomainFailure(() => validator(value, path), path);
    }
  });

  it('accepts ordinary and null-prototype objects for all record shapes', () => {
    const Type = ABClassMetadata;
    const nullRecord = (value) => Object.assign(Object.create(null), value);
    const nullAverages = nullRecord(scores());
    const nullClassAverages = nullRecord(classAverages());
    const nullEntry = nullRecord({ ...entry(), averages: nullAverages });
    const nullMetadata = nullRecord({
      classAverages: nullClassAverages,
      recentAssignments: [nullEntry],
    });
    for (const [validator, value, path] of [
      [Type.validateAverageScores, scores(), 'averages'],
      [Type.validateAverageScores, nullAverages, 'averages'],
      [Type.validateClassAverages, nullClassAverages, 'metadata.classAverages'],
      [Type.validateRecentAssignment, nullEntry, 'metadata.recentAssignments[0]'],
      [Type.validateMetadata, nullMetadata, 'metadata'],
    ])
      expect(() => validator(value, path)).not.toThrow();
  });

  it('requires every own field on each otherwise valid record shape', () => {
    const Type = ABClassMetadata;
    const shapes = [
      [
        Type.validateAverageScores,
        'averages',
        scores,
        ['completeness', 'accuracy', 'spag', 'overall'],
      ],
      [
        Type.validateClassAverages,
        'metadata.classAverages',
        classAverages,
        ['completeness', 'accuracy', 'spag', 'overall', 'updatedAt'],
      ],
      [
        Type.validateRecentAssignment,
        'metadata.recentAssignments[0]',
        entry,
        ['assignmentId', 'assignmentDefinitionKey', 'averages', 'updatedAt'],
      ],
      [Type.validateMetadata, 'metadata', metadata, ['classAverages', 'recentAssignments']],
    ];
    for (const [validator, context, makeValid, requiredKeys] of shapes) {
      for (const key of requiredKeys) {
        const record = makeValid();
        delete record[key];
        expectDomainFailure(() => validator(record, context), `${context}.${key}`);
      }
    }
  });

  it('rejects enumerable, non-enumerable and Symbol extra own keys at every shape', () => {
    const Type = ABClassMetadata;
    const shapes = [
      [Type.validateAverageScores, 'averages', scores],
      [Type.validateClassAverages, 'metadata.classAverages', classAverages],
      [Type.validateRecentAssignment, 'metadata.recentAssignments[0]', entry],
      [Type.validateMetadata, 'metadata', metadata],
    ];
    for (const [validator, context, makeValid] of shapes) {
      const enumerable = makeValid();
      enumerable.lastAssessedAt = time;
      expectDomainFailure(() => validator(enumerable, context), `${context}.lastAssessedAt`);

      const hidden = makeValid();
      Object.defineProperty(hidden, 'lastAssessedAt', { value: time });
      expectDomainFailure(() => validator(hidden, context), `${context}.lastAssessedAt`);

      const symbolic = makeValid();
      Object.defineProperty(symbolic, Symbol('unexpected'), { value: true });
      expectDomainFailure(() => validator(symbolic, context), context);
    }
  });

  it('rejects null and undefined independently at every class and entry metric path', () => {
    const Type = ABClassMetadata;
    for (const metric of ['completeness', 'accuracy', 'spag', 'overall']) {
      for (const invalid of [null, undefined]) {
        const classValue = classAverages();
        classValue[metric] = invalid;
        const classPath = `metadata.classAverages.${metric}`;
        expectDomainFailure(
          () => Type.validateClassAverages(classValue, 'metadata.classAverages'),
          classPath
        );
        const entryValue = entry();
        entryValue.averages[metric] = invalid;
        const entryPath = `metadata.recentAssignments[0].averages.${metric}`;
        expectDomainFailure(
          () => Type.validateRecentAssignment(entryValue, 'metadata.recentAssignments[0]'),
          entryPath
        );
      }
    }
  });

  it('rejects range and type violations independently at every class and entry metric path', () => {
    const Type = ABClassMetadata;
    for (const metric of ['completeness', 'accuracy', 'spag', 'overall']) {
      for (const invalid of [-1, 6, false, '2']) {
        const classValue = classAverages();
        classValue[metric] = invalid;
        const classPath = `metadata.classAverages.${metric}`;
        expectDomainFailure(
          () => Type.validateClassAverages(classValue, 'metadata.classAverages'),
          classPath
        );

        const entryValue = entry();
        entryValue.averages[metric] = invalid;
        const entryPath = `metadata.recentAssignments[0].averages.${metric}`;
        expectDomainFailure(
          () => Type.validateRecentAssignment(entryValue, 'metadata.recentAssignments[0]'),
          entryPath
        );
      }
    }
  });

  it('rejects misplaced null and undefined in every nested entry component', () => {
    const Type = ABClassMetadata;
    for (const value of [null, undefined]) {
      const cases = [
        [{ ...entry(), assignmentId: value }, 'metadata.recentAssignments[0].assignmentId'],
        [
          { ...entry(), assignmentDefinitionKey: value },
          'metadata.recentAssignments[0].assignmentDefinitionKey',
        ],
        [{ ...entry(), averages: value }, 'metadata.recentAssignments[0].averages'],
        [{ ...entry(), updatedAt: value }, 'metadata.recentAssignments[0].updatedAt'],
        [{ ...classAverages(), updatedAt: value }, 'metadata.classAverages.updatedAt'],
      ];
      for (const [record, path] of cases) {
        const validator = path.includes('recentAssignments')
          ? Type.validateRecentAssignment
          : Type.validateClassAverages;
        const context = path.includes('recentAssignments')
          ? 'metadata.recentAssignments[0]'
          : 'metadata.classAverages';
        expectDomainFailure(() => validator(record, context), path);
      }
    }
  });
});
