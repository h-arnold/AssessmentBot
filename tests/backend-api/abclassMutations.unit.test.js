/**
 * Unit tests for src/backend/z_Api/abclassMutations.js.
 * Verifies retained transport-boundary validation and delegation behaviour.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const modulePath = '../../src/backend/z_Api/abclassMutations.js';
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

let originalABClassController;

function loadAbclassMutationsModuleWithController(controllerCtor) {
  delete require.cache[require.resolve(modulePath)];
  globalThis.ABClassController = controllerCtor;
  return require(modulePath);
}

beforeEach(() => {
  originalABClassController = globalThis.ABClassController;
});

afterEach(() => {
  delete require.cache[require.resolve(modulePath)];

  if (originalABClassController === undefined) {
    delete globalThis.ABClassController;
  } else {
    globalThis.ABClassController = originalABClassController;
  }

  vi.restoreAllMocks();
});

describe('Api/abclassMutations retained transport-boundary validation', () => {
  const unsafeClassIds = [
    '../class-001',
    'class/001',
    'class' + String.fromCharCode(92) + '001',
    'class..001',
  ];

  const baseUpsertParams = {
    cohortKey: 'coh-2026',
    yearGroupKey: 'yg-10',
    courseLength: 2,
  };

  it.each(unsafeClassIds)('upsertABClass rejects unsafe classId %s', (classId) => {
    const upsertSpy = vi.fn();

    class MockABClassController {
      upsertABClass(args) {
        return upsertSpy(args);
      }
    }

    const { upsertABClass_ } = loadAbclassMutationsModuleWithController(MockABClassController);

    expect(() =>
      upsertABClass_({
        classId,
        ...baseUpsertParams,
      })
    ).toThrow(ApiValidationError);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it.each(unsafeClassIds)('updateABClass rejects unsafe classId %s', (classId) => {
    const updateSpy = vi.fn();

    class MockABClassController {
      updateABClass(args) {
        return updateSpy(args);
      }
    }

    const { updateABClass_ } = loadAbclassMutationsModuleWithController(MockABClassController);

    expect(() =>
      updateABClass_({
        classId,
      })
    ).toThrow(ApiValidationError);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it.each(unsafeClassIds)('deleteABClass rejects unsafe classId %s', (classId) => {
    const deleteSpy = vi.fn();

    class MockABClassController {
      deleteABClass(args) {
        return deleteSpy(args);
      }
    }

    const { deleteABClass_ } = loadAbclassMutationsModuleWithController(MockABClassController);

    expect(() =>
      deleteABClass_({
        classId,
      })
    ).toThrow(ApiValidationError);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['upsertABClass_', undefined],
    ['upsertABClass_', null],
    ['upsertABClass_', []],
    ['upsertABClass_', 'bad'],
    ['updateABClass_', undefined],
    ['updateABClass_', null],
    ['updateABClass_', []],
    ['updateABClass_', 'bad'],
    ['deleteABClass_', undefined],
    ['deleteABClass_', null],
    ['deleteABClass_', []],
    ['deleteABClass_', 'bad'],
  ])('%s rejects non-object params %p', (methodName, params) => {
    const upsertSpy = vi.fn();
    const updateSpy = vi.fn();
    const deleteSpy = vi.fn();

    class MockABClassController {
      upsertABClass(args) {
        return upsertSpy(args);
      }

      updateABClass(args) {
        return updateSpy(args);
      }

      deleteABClass(args) {
        return deleteSpy(args);
      }
    }

    const module = loadAbclassMutationsModuleWithController(MockABClassController);

    expect(() => module[methodName](params)).toThrow(ApiValidationError);
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it.each(['classOwner', 'teachers', 'students', 'assignments'])(
    'updateABClass rejects forbidden field %s',
    (fieldName) => {
      const updateSpy = vi.fn();

      class MockABClassController {
        updateABClass(args) {
          return updateSpy(args);
        }
      }

      const { updateABClass_ } = loadAbclassMutationsModuleWithController(MockABClassController);

      const forbiddenValue =
        fieldName === 'classOwner'
          ? { email: 'owner@example.com' }
          : fieldName === 'teachers'
            ? [{ email: 'teacher@example.com' }]
            : fieldName === 'students'
              ? [{ id: 'student-1' }]
              : [{ assignmentId: 'assignment-1' }];

      expect(() =>
        updateABClass_({
          classId: 'class-001',
          [fieldName]: forbiddenValue,
        })
      ).toThrow(ApiValidationError);

      expect(updateSpy).not.toHaveBeenCalled();
    }
  );

  it.each(['true', 1, {}, []])(
    'updateABClass rejects non-boolean/non-null active value %p',
    (active) => {
      const updateSpy = vi.fn();

      class MockABClassController {
        updateABClass(args) {
          return updateSpy(args);
        }
      }

      const { updateABClass_ } = loadAbclassMutationsModuleWithController(MockABClassController);

      expect(() =>
        updateABClass_({
          classId: 'class-001',
          active,
        })
      ).toThrow(ApiValidationError);
      expect(updateSpy).not.toHaveBeenCalled();
    }
  );

  it.each([true, false, null])('updateABClass allows active value %p', (active) => {
    const controllerResult = { classId: 'class-001', active };
    const updateSpy = vi.fn(() => controllerResult);

    class MockABClassController {
      updateABClass(args) {
        return updateSpy(args);
      }
    }

    const { updateABClass_ } = loadAbclassMutationsModuleWithController(MockABClassController);

    expect(updateABClass_({ classId: 'class-001', active })).toEqual(controllerResult);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});

describe('Api/abclassMutations mutation classId path-check type guard', () => {
  const controllerError = new Error('controller validation should own non-string classId');

  it.each([undefined, null])(
    'upsertABClass does not crash for classId=%p before controller',
    (classId) => {
      const upsertSpy = vi.fn(() => {
        throw controllerError;
      });

      class MockABClassController {
        upsertABClass(args) {
          return upsertSpy(args);
        }
      }

      const { upsertABClass_ } = loadAbclassMutationsModuleWithController(MockABClassController);

      expect(() =>
        upsertABClass_({
          classId,
          cohortKey: 'coh-2026',
          yearGroupKey: 'yg-10',
          courseLength: 2,
        })
      ).toThrow(controllerError);
      expect(upsertSpy).toHaveBeenCalledTimes(1);
    }
  );

  it.each([undefined, null])(
    'updateABClass does not crash for classId=%p before controller',
    (classId) => {
      const updateSpy = vi.fn(() => {
        throw controllerError;
      });

      class MockABClassController {
        updateABClass(args) {
          return updateSpy(args);
        }
      }

      const { updateABClass_ } = loadAbclassMutationsModuleWithController(MockABClassController);

      expect(() =>
        updateABClass_({
          classId,
        })
      ).toThrow(controllerError);
      expect(updateSpy).toHaveBeenCalledTimes(1);
    }
  );

  it.each([undefined, null])(
    'deleteABClass does not crash for classId=%p before controller',
    (classId) => {
      const deleteSpy = vi.fn(() => {
        throw controllerError;
      });

      class MockABClassController {
        deleteABClass(args) {
          return deleteSpy(args);
        }
      }

      const { deleteABClass_ } = loadAbclassMutationsModuleWithController(MockABClassController);

      expect(() =>
        deleteABClass_({
          classId,
        })
      ).toThrow(controllerError);
      expect(deleteSpy).toHaveBeenCalledTimes(1);
    }
  );
});
