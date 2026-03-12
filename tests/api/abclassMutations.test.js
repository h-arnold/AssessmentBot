import { afterEach, describe, expect, it, vi } from 'vitest';

const abclassMutationsModulePath = '../../src/backend/z_Api/abclassMutations.js';
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');
const originalABClassController = globalThis.ABClassController;

function clearAbclassMutationsModuleCache() {
  delete require.cache[require.resolve(abclassMutationsModulePath)];
}

function loadAbclassMutationsModuleWithGlobals({ controllerCtor } = {}) {
  clearAbclassMutationsModuleCache();

  if (controllerCtor === undefined) {
    delete globalThis.ABClassController;
  } else {
    globalThis.ABClassController = controllerCtor;
  }

  return require(abclassMutationsModulePath);
}

function buildClassSummary(overrides = {}) {
  return {
    classId: 'class-001',
    className: '10A Computer Science',
    cohort: '2026',
    courseLength: 2,
    yearGroup: 10,
    classOwner: {
      email: 'owner@example.com',
      userId: 'owner-001',
      teacherName: 'Owner One',
    },
    teachers: [
      {
        email: 'teacher.one@example.com',
        userId: 'teacher-001',
        teacherName: 'Teacher One',
      },
    ],
    active: true,
    ...overrides,
  };
}

function buildForbiddenUpdatePayload(overrides = {}) {
  return {
    classId: 'class-001',
    classOwner: {
      email: 'mutated-owner@example.com',
      userId: 'owner-mutated',
      teacherName: 'Mutated Owner',
    },
    teachers: [
      {
        email: 'mutated-teacher@example.com',
        userId: 'teacher-mutated',
        teacherName: 'Mutated Teacher',
      },
    ],
    students: [{ id: 'student-mutated', name: 'Mutated Student', email: 'mutated@example.com' }],
    assignments: [{ assignmentId: 'assignment-mutated', title: 'Mutated Assignment' }],
    ...overrides,
  };
}

afterEach(() => {
  clearAbclassMutationsModuleCache();

  if (originalABClassController === undefined) {
    delete globalThis.ABClassController;
  } else {
    globalThis.ABClassController = originalABClassController;
  }

  vi.restoreAllMocks();
});

describe('Api/abclassMutations exports', () => {
  it('exports upsertABClass, updateABClass, and deleteABClass in Node test runtime', () => {
    const abclassMutationsModule = require('../../src/backend/z_Api/abclassMutations.js');

    expect(abclassMutationsModule).toEqual(
      expect.objectContaining({
        upsertABClass: expect.any(Function),
        updateABClass: expect.any(Function),
        deleteABClass: expect.any(Function),
      })
    );
  });
});

describe('Api/abclassMutations direct handlers (Section 3)', () => {
  it('upsertABClass delegates valid params to controller and returns the controller summary payload', () => {
    const params = {
      classId: 'class-001',
      cohort: '2026',
      yearGroup: 10,
      courseLength: 2,
    };
    const controllerResult = buildClassSummary();
    const upsertSpy = vi.fn(() => controllerResult);

    class MockABClassController {
      upsertABClass(args) {
        return upsertSpy(args);
      }
    }

    const { upsertABClass } = loadAbclassMutationsModuleWithGlobals({
      controllerCtor: MockABClassController,
    });

    expect(upsertABClass(params)).toEqual(controllerResult);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenCalledWith(params);
    expect(controllerResult).not.toHaveProperty('students');
    expect(controllerResult).not.toHaveProperty('assignments');
  });

  it('updateABClass delegates valid params to controller and returns the controller summary payload', () => {
    const params = {
      classId: 'class-001',
      cohort: '2027',
      yearGroup: 11,
      courseLength: 3,
      active: false,
    };
    const controllerResult = buildClassSummary({
      cohort: '2027',
      yearGroup: 11,
      courseLength: 3,
      active: false,
    });
    const updateSpy = vi.fn(() => controllerResult);

    class MockABClassController {
      updateABClass(args) {
        return updateSpy(args);
      }
    }

    const { updateABClass } = loadAbclassMutationsModuleWithGlobals({
      controllerCtor: MockABClassController,
    });

    expect(updateABClass(params)).toEqual(controllerResult);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith(params);
    expect(controllerResult).not.toHaveProperty('students');
    expect(controllerResult).not.toHaveProperty('assignments');
  });

  it.each([
    ['upsertABClass', { cohort: '2026', yearGroup: 10, courseLength: 2 }],
    ['upsertABClass', { classId: 'class-001', yearGroup: 10, courseLength: 2 }],
    ['upsertABClass', { classId: 'class-001', cohort: '2026', courseLength: 2 }],
    ['upsertABClass', { classId: 'class-001', cohort: '2026', yearGroup: 10 }],
    ['updateABClass', {}],
  ])('throws ApiValidationError when required params are missing for %s', (methodName, params) => {
    const upsertSpy = vi.fn();
    const updateSpy = vi.fn();

    class MockABClassController {
      upsertABClass(args) {
        return upsertSpy(args);
      }

      updateABClass(args) {
        return updateSpy(args);
      }
    }

    const abclassMutationsModule = loadAbclassMutationsModuleWithGlobals({
      controllerCtor: MockABClassController,
    });

    expect(() => abclassMutationsModule[methodName](params)).toThrow(ApiValidationError);
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['upsertABClass', { classId: 'class-001', cohort: '2026', yearGroup: 10, courseLength: '2' }],
    ['upsertABClass', { classId: 'class-001', cohort: '2026', yearGroup: 10, courseLength: 0 }],
    ['updateABClass', { classId: 'class-001', courseLength: '2' }],
    ['updateABClass', { classId: 'class-001', courseLength: 0 }],
  ])('throws ApiValidationError when courseLength is invalid for %s', (methodName, params) => {
    const upsertSpy = vi.fn();
    const updateSpy = vi.fn();

    class MockABClassController {
      upsertABClass(args) {
        return upsertSpy(args);
      }

      updateABClass(args) {
        return updateSpy(args);
      }
    }

    const abclassMutationsModule = loadAbclassMutationsModuleWithGlobals({
      controllerCtor: MockABClassController,
    });

    expect(() => abclassMutationsModule[methodName](params)).toThrow(ApiValidationError);
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it.each([
    [
      'classOwner',
      buildForbiddenUpdatePayload({
        teachers: undefined,
        students: undefined,
        assignments: undefined,
      }),
    ],
    [
      'teachers',
      buildForbiddenUpdatePayload({
        classOwner: undefined,
        students: undefined,
        assignments: undefined,
      }),
    ],
    [
      'students',
      buildForbiddenUpdatePayload({
        classOwner: undefined,
        teachers: undefined,
        assignments: undefined,
      }),
    ],
    [
      'assignments',
      buildForbiddenUpdatePayload({
        classOwner: undefined,
        teachers: undefined,
        students: undefined,
      }),
    ],
  ])(
    'updateABClass rejects forbidden supplied field %s so roster/full-record fields are not patchable through this endpoint',
    (_fieldName, params) => {
      const updateSpy = vi.fn();

      class MockABClassController {
        updateABClass(args) {
          return updateSpy(args);
        }
      }

      const { updateABClass } = loadAbclassMutationsModuleWithGlobals({
        controllerCtor: MockABClassController,
      });

      expect(() => updateABClass(params)).toThrow(ApiValidationError);
      expect(updateSpy).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['with only classId supplied', { classId: 'class-001' }, true],
    ['with active=true', { classId: 'class-001', active: true }, true],
    ['with active=false', { classId: 'class-001', active: false }, false],
    ['with active=null', { classId: 'class-001', active: null }, null],
  ])(
    'updateABClass allows omitted optional fields and active boolean/null handling %s',
    (_label, params, activeValue) => {
      const controllerResult = buildClassSummary({ active: activeValue });
      const updateSpy = vi.fn(() => controllerResult);

      class MockABClassController {
        updateABClass(args) {
          return updateSpy(args);
        }
      }

      const { updateABClass } = loadAbclassMutationsModuleWithGlobals({
        controllerCtor: MockABClassController,
      });

      expect(updateABClass(params)).toEqual(controllerResult);
      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith(params);
    }
  );
});
