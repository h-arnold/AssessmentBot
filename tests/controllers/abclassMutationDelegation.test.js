import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';
import { cleanupControllerTestMocks, setupControllerTestMocks } from '../helpers/mockFactories.js';

const { ABClass } = require('#backend/Models/ABClass.js');
const ABClassController = require('#backend/y_controllers/ABClassController/index.js');

beforeEach(() => setupControllerTestMocks(vi));

afterEach(() => {
  cleanupControllerTestMocks();
  vi.restoreAllMocks();
});

describe('ABClass mutation owner boundary', () => {
  it('registers the mutation owner in the normal backend test bootstrap', () => {
    expect(typeof globalThis.ABClassMutationOps).toBe('function');
  });

  it.each(['upsertABClass', 'updateABClass', 'deleteABClass'])(
    'delegates %s with unchanged parameters and preserves return/error identity',
    (method) => {
      const controller = new ABClassController();
      expect(controller._mutationOps).toBeDefined();

      const parameters = { classId: 'unchanged-parameters' };
      const summary = { classId: 'returned-summary' };
      const failure = new Error('owner failure');
      const delegate = vi.fn(() => summary);
      controller._mutationOps[method] = delegate;

      expect(controller[method](parameters)).toBe(summary);
      expect(delegate.mock.calls[0][0]).toBe(parameters);

      delegate.mockImplementation(() => {
        throw failure;
      });
      let caught;
      try {
        controller[method](parameters);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(failure);
      expect(delegate.mock.calls[1][0]).toBe(parameters);
    }
  );

  it('provides one-options-object construction while retaining injected dependency identities', () => {
    // Confirm normal bootstrap wiring before exercising the owner directly.
    expect(typeof globalThis.ABClassMutationOps).toBe('function');
    const MutationOps = require('#backend/y_controllers/ABClassController/ABClassMutationOps.js');
    const dependencies = {
      dbManager: {},
      validation: {},
      persistence: {},
      roster: {},
      responseMapper: {},
    };
    const owner = new MutationOps(dependencies);

    expect(owner._dbManager).toBe(dependencies.dbManager);
    expect(owner._validation).toBe(dependencies.validation);
    expect(owner._persistence).toBe(dependencies.persistence);
    expect(owner._roster).toBe(dependencies.roster);
    expect(owner._responseMapper).toBe(dependencies.responseMapper);

    const controller = new ABClassController();
    expect(controller._mutationOps._dbManager).toBe(controller._dbManager);
    expect(controller._mutationOps._validation).toBe(controller._validation);
    expect(controller._mutationOps._persistence).toBe(controller._persistence);
    expect(controller._mutationOps._roster).toBe(controller._roster);
    expect(controller._mutationOps._responseMapper).toBe(controller._responseMapper);
  });

  it.each(['new', 'existing'])(
    'validates before persisting on the %s-class upsert path',
    (path) => {
      expect(typeof globalThis.ABClassMutationOps).toBe('function');
      const MutationOps = require('#backend/y_controllers/ABClassController/ABClassMutationOps.js');
      const calls = [];
      const validation = {
        _validateRequestMetadata: vi.fn(),
        _validateClassId: vi.fn((classId) => classId),
        _validateCourseLength: vi.fn((length) => length),
        _validateClassForSave: vi.fn((value) => calls.push(['validate', value])),
      };
      const canonical = loadBackendModelInputs('small');
      const validClassDocument = Object.values(canonical.classesById).find(
        (row) => row.cohortKey !== null && row.yearGroupKey !== null && row.courseLength >= 1
      );
      expect(validClassDocument).toBeDefined();
      const classDocument = structuredClone(validClassDocument);
      const classModel = ABClass.fromJSON(classDocument);
      const classCollection = {
        findOne: vi.fn(() => (path === 'existing' ? classDocument : null)),
      };
      const dbManager = { getCollection: vi.fn(() => classCollection) };
      const roster = {
        initialise: vi.fn(() => classModel),
        _refreshRoster: vi.fn(),
      };
      const persistence = {
        persistClassAndPartial: vi.fn((value) => calls.push(['persist', value])),
      };
      const summary = { classId: classModel.classId };
      const buildClassSummary = vi.fn((value) => {
        calls.push(['summary', value]);
        return summary;
      });
      const owner = new MutationOps({
        dbManager,
        validation,
        persistence,
        roster,
        responseMapper: { _buildClassSummary: buildClassSummary },
      });

      const result = withTemporaryGlobals({ ABClass: () => ABClass }, () =>
        owner.upsertABClass({
          classId: classModel.classId,
          cohortKey: classModel.cohortKey,
          yearGroupKey: classModel.yearGroupKey,
          courseLength: classModel.courseLength,
        })
      );

      expect(result).toBe(summary);
      expect(validation._validateRequestMetadata).toHaveBeenCalledTimes(1);
      expect(validation._validateRequestMetadata.mock.calls[0][0]).toEqual({
        classId: classModel.classId,
        cohortKey: classModel.cohortKey,
        yearGroupKey: classModel.yearGroupKey,
        courseLength: classModel.courseLength,
      });
      expect(dbManager.getCollection).toHaveBeenCalledTimes(1);
      expect(calls.map(([operation]) => operation)).toEqual(['validate', 'persist', 'summary']);
      const validatedClass = calls[0][1];
      expect(validatedClass).toBeInstanceOf(ABClass);
      expect(calls[1][1]).toBe(validatedClass);
      expect(calls[2][1]).toBe(validatedClass);
      expect(validatedClass.classId).toBe(classModel.classId);
      expect(validatedClass.cohortKey).toBe(classModel.cohortKey);
      expect(validatedClass.yearGroupKey).toBe(classModel.yearGroupKey);
      expect(validatedClass.courseLength).toBe(classModel.courseLength);
      expect(roster.initialise).toHaveBeenCalledTimes(path === 'new' ? 1 : 0);
      expect(roster._refreshRoster).toHaveBeenCalledTimes(path === 'existing' ? 1 : 0);
    }
  );

  it('keeps saveClass validation, persistence delegation, and true result on the facade', () => {
    const controller = new ABClassController();
    const validationError = new TypeError(
      'saveClass: expected an ABClass instance or plain object with classId and toPartialJSON()'
    );
    const invalid = null;
    expect(() => controller.saveClass(invalid)).toThrow(validationError.message);

    const plainClass = {
      classId: 'plain-class',
      toPartialJSON: vi.fn(() => ({ classId: 'plain-class' })),
    };
    const persist = vi.spyOn(controller, '_persistClassAndPartial').mockImplementation(() => {});
    expect(controller.saveClass(plainClass)).toBe(true);
    expect(persist).toHaveBeenCalledWith(plainClass);
  });

  it('calls shared save validation before its existing persistence delegator', () => {
    const controller = new ABClassController();
    const calls = [];
    const input = { classId: 'plain-class', toPartialJSON: vi.fn() };
    controller._validation._validateClassForSave = vi.fn((value) =>
      calls.push(['validate', value])
    );
    vi.spyOn(controller, '_persistClassAndPartial').mockImplementation((value) =>
      calls.push(['persist', value])
    );

    expect(controller.saveClass(input)).toBe(true);
    expect(calls.map(([operation]) => operation)).toEqual(['validate', 'persist']);
    expect(calls[0][1]).toBe(input);
    expect(calls[1][1]).toBe(input);
  });

  it('preserves saveClass validation messages and the model/plain-object contract', () => {
    const controller = new ABClassController();
    const model = { classId: 'model-class', toPartialJSON: vi.fn() };
    const persist = vi.spyOn(controller, '_persistClassAndPartial').mockImplementation(() => {});

    expect(controller.saveClass(model)).toBe(true);
    expect(persist).toHaveBeenCalledWith(model);
    expect(() => controller.saveClass({ toPartialJSON: vi.fn() })).toThrow(
      'saveClass: missing required classId property on abClass argument'
    );
    expect(() => controller.saveClass({ classId: '   ', toPartialJSON: vi.fn() })).toThrow(
      'saveClass: expected abClass.classId to be a non-empty string'
    );
    expect(() => controller.saveClass({ classId: '../unsafe', toPartialJSON: vi.fn() })).toThrow(
      'saveClass: invalid classId format'
    );
    expect(() => controller.saveClass({ classId: 'valid' })).toThrow(
      'saveClass: expected abClass.toPartialJSON() to be a function for partial persistence'
    );
  });
});
