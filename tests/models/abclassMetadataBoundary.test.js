import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const classPath = '#backend/Models/ABClass.js';

function getDomain() {
  try {
    return require('#backend/Models/ABClassMetadata.js').ABClassMetadata;
  } catch {
    return null;
  }
}

const instant = '2024-02-29T12:34:56.789Z';
const validMetadata = () => ({
  classAverages: {
    completeness: 0,
    accuracy: 5,
    spag: 'N',
    overall: 'excluded',
    updatedAt: instant,
  },
  recentAssignments: [
    {
      assignmentId: 'opaque-id',
      assignmentDefinitionKey: 'repeatable-key',
      averages: { completeness: 2.5, accuracy: 'E', spag: 0, overall: 5 },
      updatedAt: instant,
    },
  ],
});

function findOwnedSnapshot(owner) {
  const visited = new Set();
  const pending = [owner];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || visited.has(value)) continue;
    visited.add(value);
    if (Object.hasOwn(value, 'classAverages') && Object.hasOwn(value, 'recentAssignments'))
      return value;
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if (Object.hasOwn(descriptor, 'value')) pending.push(descriptor.value);
    }
  }
  return null;
}

describe('ABClassMetadata ownership boundary', () => {
  it('imports the existing ABClass model directly under the ordinary test bootstrap', () => {
    expect(globalThis.ABClassMetadata).toBe(
      require('#backend/Models/ABClassMetadata.js').ABClassMetadata
    );
    expect(globalThis.ABClassMetadataValidationError).toBe(
      require('#backend/Utils/ErrorTypes/ABClassMetadataValidationError.js')
        .ABClassMetadataValidationError
    );
    const { ABClass } = require(classPath);
    expect(ABClass).toBeTypeOf('function');
    expect(ABClass.fromJSON({ classId: 'bootstrap' })).toBeInstanceOf(ABClass);
    expect(globalThis.ABClassMetadata.validateAverageScore(0, 'score')).toBeUndefined();
  });

  it('constructs null only for omitted arguments and rejects explicit undefined', () => {
    const Type = getDomain();
    expect(typeof Type).toBe('function');
    if (!Type) return;
    expect(new Type().toJSON()).toBeNull();
    expect(new Type(null).toJSON()).toBeNull();
    expect(() => new Type(undefined)).toThrow();
    expect(() => new Type({})).toThrow();
  });

  it('isolates every constructor input and each independently returned snapshot', () => {
    const Type = getDomain();
    expect(typeof Type).toBe('function');
    if (!Type) return;
    for (const name of [
      'validateAverageScore',
      'validateAverageScores',
      'validateClassAverages',
      'validateRecentAssignment',
      'validateMetadata',
    ])
      expect(Type[name]).toBeTypeOf('function');
    const supplied = validMetadata();
    const domain = new Type(supplied);
    const first = domain.toJSON();
    const second = domain.toJSON();
    expect(first).toEqual(supplied);
    expect(first).not.toBe(supplied);
    expect(first).not.toBe(second);
    expect(first.classAverages).not.toBe(supplied.classAverages);
    expect(first.recentAssignments).not.toBe(supplied.recentAssignments);
    expect(first.recentAssignments[0]).not.toBe(supplied.recentAssignments[0]);
    expect(first.recentAssignments[0].averages).not.toBe(supplied.recentAssignments[0].averages);
    supplied.classAverages.overall = 1;
    supplied.recentAssignments.push({});
    supplied.recentAssignments[0].assignmentId = 'changed';
    supplied.recentAssignments[0].averages.overall = 99;
    expect(domain.toJSON().recentAssignments[0].averages.overall).toBe(5);
    expect(domain.toJSON().classAverages.overall).toBe('excluded');
    expect(domain.toJSON().recentAssignments).toHaveLength(1);
    expect(domain.toJSON().recentAssignments[0].assignmentId).toBe('opaque-id');

    first.classAverages.overall = 'invalid';
    first.recentAssignments[0].assignmentId = 'changed';
    first.recentAssignments[0].averages.overall = 'invalid';
    first.recentAssignments.push({});
    expect(second).toEqual(validMetadata());
    expect(domain.toJSON()).toEqual(validMetadata());
  });

  it('copies accepted Array subclasses without trusting their inherited map method', () => {
    const Type = getDomain();
    expect(typeof Type).toBe('function');
    if (!Type) return;

    class Entries extends Array {
      map() {
        return this;
      }
    }

    const inputEntries = new Entries(validMetadata().recentAssignments[0]);
    const supplied = { ...validMetadata(), recentAssignments: inputEntries };
    const domain = new Type(supplied);
    const first = domain.toJSON();
    const second = domain.toJSON();

    expect(first.recentAssignments).toBeInstanceOf(Array);
    expect(Object.getPrototypeOf(first.recentAssignments)).toBe(Array.prototype);
    expect(first.recentAssignments).not.toBe(inputEntries);
    expect(first.recentAssignments).not.toBe(second.recentAssignments);
    expect(first.recentAssignments[0]).not.toBe(inputEntries[0]);
    expect(first.recentAssignments[0].averages).not.toBe(inputEntries[0].averages);

    inputEntries[0].averages.overall = 4;
    expect(domain.toJSON().recentAssignments[0].averages.overall).toBe(5);

    first.recentAssignments[0].averages.overall = 3;
    expect(second.recentAssignments[0].averages.overall).toBe(5);
    expect(domain.toJSON().recentAssignments[0].averages.overall).toBe(5);
    expect(inputEntries[0].averages.overall).toBe(4);
  });

  it('revalidates a corrupted owned snapshot during serialisation', () => {
    const Type = getDomain();
    expect(typeof Type).toBe('function');
    if (!Type) return;
    const domain = new Type(validMetadata());
    const owned = findOwnedSnapshot(domain);
    expect(owned).not.toBeNull();
    if (!owned) return;
    owned.recentAssignments[0].averages.overall = 'invalid';
    let failure;
    try {
      domain.toJSON();
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(globalThis.ABClassMetadataValidationError);
    expect(failure.fieldPath).toBe('metadata.recentAssignments[0].averages.overall');
    expect(failure.message).toContain(failure.fieldPath);
    expect(failure.inputSource).not.toBe('request');
    expect(failure).not.toBeInstanceOf(globalThis.ApiValidationError);
  });

  it('returns errors with metadata field provenance and no ApiValidationError inheritance', () => {
    let ErrorType;
    try {
      ErrorType =
        require('#backend/Utils/ErrorTypes/ABClassMetadataValidationError.js').ABClassMetadataValidationError;
    } catch {
      ErrorType = null;
    }
    expect(typeof ErrorType).toBe('function');
    if (!ErrorType) return;
    const failure = new ErrorType('Invalid', 'metadata.recentAssignments[0].assignmentId');
    expect(failure.fieldPath).toBe('metadata.recentAssignments[0].assignmentId');
    expect(failure.inputSource).not.toBe('request');
    expect(failure).not.toBeInstanceOf(globalThis.ApiValidationError);
  });

  it('evaluates runtime definitions in GAS order and defers forward references until use', () => {
    const paths = [
      'src/backend/Models/ABClass.js',
      'src/backend/Models/ABClassMetadata.js',
      'src/backend/Utils/Validate.js',
      'src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js',
    ];
    const missing = paths.filter((path) => !existsSync(path));
    expect(missing).toEqual([]);
    if (missing.length) return;
    const context = { module: undefined, console };
    vm.createContext(context);
    for (const path of paths)
      vm.runInContext(readFileSync(path, 'utf8'), context, { filename: path });
    const result = vm.runInContext(
      `(() => {
      const supplied = ${JSON.stringify(validMetadata())};
      const model = new ABClassMetadata(supplied);
      let errorTypeResolved = false;
      try { ABClassMetadata.validateAverageScore(-1, 'metadata.classAverages.overall'); }
      catch (error) { errorTypeResolved = error.name === 'ABClassMetadataValidationError'; }
      return {
        validatorPresent: typeof Validate === 'object',
        predicateResult: Validate.isCanonicalUtcDateTime('${instant}'),
        metadataTimestamp: model.toJSON().classAverages.updatedAt,
        classAvailable: typeof ABClass === 'function',
        errorTypeResolved,
      };
    })()`,
      context
    );
    expect(result).toEqual({
      validatorPresent: true,
      predicateResult: true,
      metadataTimestamp: instant,
      classAvailable: true,
      errorTypeResolved: true,
    });
  });
});
