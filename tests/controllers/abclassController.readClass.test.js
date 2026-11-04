/**
 * ABClassController.readClass and _toReadView tests
 *
 * RED phase: tests for the new pure-read methods readClass(classId) and
 * _toReadView(abClass). All tests fail because the methods don't exist yet.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ABClass,
  Assignment,
  ClassNotFoundError,
  Student,
  Teacher,
  buildExistingClassDoc,
  buildExpectedReadView,
  setupCollectionRouter,
} from '../helpers/abclassReadClassTestHelpers.js';
import {
  cleanupControllerTestMocks,
  createMockCollection,
  setupControllerTestMocks,
} from '../helpers/mockFactories.js';

/* ------------------------------------------------------------------ */
/*  Variables shared across tests                                      */
/* ------------------------------------------------------------------ */

let ABClassController;
let classCollection;

function loadControllerModule() {
  delete require.cache[require.resolve('../../src/backend/y_controllers/ABClassController')];
  ABClassController = require('#backend/y_controllers/ABClassController/index.js');
}

/* ------------------------------------------------------------------ */
/*  Setup / teardown                                                   */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  classCollection = createMockCollection(vi);

  setupControllerTestMocks(vi);
  setupCollectionRouter(vi, classCollection);

  globalThis.ABClass = ABClass;
  globalThis.Teacher = Teacher;
  globalThis.Student = Student;
  globalThis.Assignment = {
    fromJSON: vi.fn((json) => {
      // Create a minimal assignment-like object that matches the shape
      const assignment = { ...json, _hydrationLevel: 'partial' };
      // Define toPartialJSON as non-enumerable to match the real prototype
      // behaviour — prevents function properties leaking through serialisation.
      Object.defineProperty(assignment, 'toPartialJSON', {
        value: vi.fn(() => {
          const { _hydrationLevel, progressTracker, ...partial } = assignment;
          return partial;
        }),
        enumerable: false,
        writable: true,
        configurable: true,
      });
      return assignment;
    }),
  };

  loadControllerModule();
});

afterEach(() => {
  cleanupControllerTestMocks();
  delete globalThis.ABClass;
  delete globalThis.Teacher;
  delete globalThis.Student;
  delete globalThis.Assignment;
  delete require.cache[require.resolve('../../src/backend/y_controllers/ABClassController')];
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ABClassController.readClass', () => {
  /* 1. GREEN — readClass exists on the prototype */
  it('is defined on the prototype (GREEN: method now exists)', () => {
    const controller = new ABClassController();
    expect(typeof controller.readClass).toBe('function');
  });

  /* 2. GREEN — _toReadView exists on the prototype */
  it('_toReadView is defined on the prototype (GREEN: method now exists)', () => {
    const controller = new ABClassController();
    expect(typeof controller._toReadView).toBe('function');
  });

  /* 3. readClass throws ClassNotFoundError when collection is missing */
  it('throws ClassNotFoundError when collection lookup returns null', () => {
    const router = {
      getCollection: vi.fn().mockReturnValue(null),
    };
    globalThis.DbManager = { getInstance: () => router };
    loadControllerModule();

    const controller = new ABClassController();

    expect(() => controller.readClass('nonexistent-id')).toThrow(ClassNotFoundError);
    expect(() => controller.readClass('nonexistent-id')).toThrow(/nonexistent-id/);
    expect(router.getCollection).toHaveBeenCalledWith('nonexistent-id');
  });

  /* 4. readClass throws ClassNotFoundError when document is missing */
  it('throws ClassNotFoundError when findOne returns null', () => {
    classCollection.findOne.mockReturnValue(null);

    const controller = new ABClassController();

    expect(() => controller.readClass('class-existing')).toThrow(ClassNotFoundError);
    expect(() => controller.readClass('class-existing')).toThrow(/class-existing/);
    expect(classCollection.findOne).toHaveBeenCalledWith({ classId: 'class-existing' });
  });

  /* 5. readClass returns the read view when a stored class document exists */
  it('returns the read view when a stored class document exists', () => {
    const existingDoc = buildExistingClassDoc();
    classCollection.findOne.mockReturnValue(existingDoc);

    const controller = new ABClassController();

    const result = controller.readClass('class-existing');

    // Must be a plain object, not an ABClass instance
    expect(result).not.toBeInstanceOf(ABClass);
    expect(result).toEqual(buildExpectedReadView(existingDoc));
    expect(classCollection.findOne).toHaveBeenCalledWith({ classId: 'class-existing' });
  });

  /* 6. No write effects — _refreshRoster and _persistRoster are NOT called */
  it('does not call _refreshRoster or _persistRoster', () => {
    const existingDoc = buildExistingClassDoc();
    classCollection.findOne.mockReturnValue(existingDoc);

    const controller = new ABClassController();
    const refreshSpy = vi.spyOn(controller, '_refreshRoster');
    const persistSpy = vi.spyOn(controller, '_persistRoster');

    controller.readClass('class-existing');

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(persistSpy).not.toHaveBeenCalled();
  });
});
