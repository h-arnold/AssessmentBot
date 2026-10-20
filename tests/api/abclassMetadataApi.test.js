import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';

const { saveGlobals, restoreGlobals } = require('#test-helpers/globalMockManager.js');
const ApiValidationError = require('#backend/Utils/ErrorTypes/ApiValidationError.js');
const {
  ABClassMetadataValidationError,
} = require('#backend/Utils/ErrorTypes/ABClassMetadataValidationError.js');
const originalGlobals = saveGlobals(['ABClassController']);
const canonicalMetadata = Object.values(loadBackendModelInputs('small').classesById).find(
  (row) => row.metadata !== null
).metadata;

afterEach(() => {
  restoreGlobals(originalGlobals);
  vi.restoreAllMocks();
});

function handlers(controller) {
  globalThis.ABClassController = class {
    constructor() {
      return controller;
    }
  };
  return require('#backend/z_Api/abclass/abclassMutations.js');
}

describe('ABClass mutation transport forwarding', () => {
  it.each(['upsertABClass_', 'updateABClass_'])(
    '%s forwards omitted, null, and canonical metadata unchanged',
    (name) => {
      for (const params of [
        { classId: 'class-a' },
        { classId: 'class-a', metadata: null },
        { classId: 'class-a', metadata: structuredClone(canonicalMetadata) },
        { classId: 'class-a', metadata: undefined },
      ]) {
        const delegated = vi.fn((request) => request);
        const controller = {
          [name === 'upsertABClass_' ? 'upsertABClass' : 'updateABClass']: delegated,
        };
        const transport = handlers(controller);
        expect(transport[name](params)).toBe(params);
        expect(delegated).toHaveBeenCalledWith(params);
        expect(delegated.mock.calls[0][0]).toBe(params);
      }
    }
  );

  it.each(['upsertABClass_', 'updateABClass_'])(
    '%s adapts only typed request-originated metadata errors',
    (name) => {
      const method = name === 'upsertABClass_' ? 'upsertABClass' : 'updateABClass';
      const typedRequestError = new ABClassMetadataValidationError(
        'Invalid score',
        'metadata.classAverages.overall'
      );
      typedRequestError.inputSource = 'request';
      const transport = handlers({
        [method]: () => {
          throw typedRequestError;
        },
      });
      let caught;
      try {
        transport[name]({ classId: 'class-a' });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ApiValidationError);
      expect(caught.message).toBe(typedRequestError.message);
    }
  );

  it.each([
    ['model typed', new ABClassMetadataValidationError('bad', 'metadata.classAverages.overall')],
    ['generic same-message', new Error('Invalid score (metadata.classAverages.overall)')],
    [
      'request-tagged generic',
      Object.assign(new TypeError('Invalid score (metadata.classAverages.overall)'), {
        inputSource: 'request',
      }),
    ],
    [
      'request-tagged wrong typed error',
      Object.assign(new RangeError('Invalid score (metadata.classAverages.overall)'), {
        inputSource: 'request',
      }),
    ],
    ['persistence', new Error('database failed')],
    ['upstream', new Error('Classroom unavailable')],
    ['wiring', new Error('controller is not configured')],
  ])('preserves %s failures by identity', (_label, error) => {
    for (const [wrapper, method] of [
      ['upsertABClass_', 'upsertABClass'],
      ['updateABClass_', 'updateABClass'],
    ]) {
      const transport = handlers({
        [method]: () => {
          throw error;
        },
      });
      let caught;
      try {
        transport[wrapper]({ classId: 'class-a' });
      } catch (failure) {
        caught = failure;
      }
      expect(caught).toBe(error);
    }
  });
});
