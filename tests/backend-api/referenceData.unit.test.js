/**
 * Unit tests for src/backend/z_Api/referenceData.js
 * Verifies that the thin API handlers resolve ReferenceDataController and delegate
 * with the expected payload shapes for cohort and year-group CRUD operations.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Api/referenceData - direct unit delegation tests', () => {
  const modulePath = '../../src/backend/z_Api/referenceData.js';
  let originalController;
  let controllerMethods;

  function loadApiModule() {
    // Fresh import so it picks up the stubbed global controller constructor.
    delete require.cache[require.resolve(modulePath)];
    return require(modulePath);
  }

  beforeEach(() => {
    originalController = globalThis.ReferenceDataController;
    controllerMethods = {
      listCohorts: vi.fn(() => [{ name: 'Cohort 2026', active: true }]),
      createCohort: vi.fn((record) => ({ ...record })),
      updateCohort: vi.fn((payload) => ({ ...payload.record })),
      deleteCohort: vi.fn((name) => ({ transport: 'plain-data', name })),
      listYearGroups: vi.fn(() => [{ name: 'Year 10' }]),
      createYearGroup: vi.fn((record) => ({ ...record })),
      updateYearGroup: vi.fn((payload) => ({ ...payload.record })),
      deleteYearGroup: vi.fn((name) => ({ transport: 'plain-data', name })),
    };

    globalThis.ReferenceDataController = vi.fn(function StubReferenceDataController() {
      return controllerMethods;
    });
  });

  afterEach(() => {
    if (originalController === undefined) delete globalThis.ReferenceDataController;
    else globalThis.ReferenceDataController = originalController;
    vi.restoreAllMocks();
  });

  it.each([
    ['getCohorts', 'listCohorts', undefined, [{ name: 'Cohort 2026', active: true }]],
    [
      'createCohort',
      'createCohort',
      { record: { name: 'Cohort 2026', active: true } },
      { name: 'Cohort 2026', active: true },
    ],
    [
      'updateCohort',
      'updateCohort',
      {
        originalName: 'Cohort 2025',
        record: { name: 'Cohort 2026', active: false },
      },
      { name: 'Cohort 2026', active: false },
    ],
    ['deleteCohort', 'deleteCohort', { name: 'Cohort 2026' }],
    ['getYearGroups', 'listYearGroups', undefined, [{ name: 'Year 10' }]],
    ['createYearGroup', 'createYearGroup', { record: { name: 'Year 10' } }, { name: 'Year 10' }],
    [
      'updateYearGroup',
      'updateYearGroup',
      {
        originalName: 'Year 9',
        record: { name: 'Year 10' },
      },
      { name: 'Year 10' },
    ],
    ['deleteYearGroup', 'deleteYearGroup', { name: 'Year 10' }],
  ])(
    '%s() resolves ReferenceDataController and delegates to %s()',
    (handlerName, controllerMethodName, params, expectedResult) => {
      const api = loadApiModule();

      expect(api[handlerName]).toBeTypeOf('function');

      const result = params === undefined ? api[handlerName]() : api[handlerName](params);

      expect(globalThis.ReferenceDataController).toHaveBeenCalledTimes(1);
      if (params === undefined) {
        expect(controllerMethods[controllerMethodName]).toHaveBeenCalledTimes(1);
        expect(controllerMethods[controllerMethodName]).toHaveBeenCalledWith();
      } else if (handlerName === 'createCohort' || handlerName === 'createYearGroup') {
        expect(controllerMethods[controllerMethodName]).toHaveBeenCalledWith(params.record);
      } else if (handlerName === 'deleteCohort' || handlerName === 'deleteYearGroup') {
        expect(controllerMethods[controllerMethodName]).toHaveBeenCalledWith(params.name);
      } else {
        expect(controllerMethods[controllerMethodName]).toHaveBeenCalledWith(params);
      }
      if (handlerName === 'deleteCohort' || handlerName === 'deleteYearGroup') {
        expect(result).toEqual(controllerMethods[controllerMethodName].mock.results[0].value);
      } else {
        expect(result).toEqual(expectedResult);
      }
    }
  );

  it('propagates controller errors without wrapping them inside the thin reference-data API module', () => {
    controllerMethods.createCohort.mockImplementation(() => {
      throw new Error('controller create failure');
    });

    const api = loadApiModule();

    expect(() =>
      api.createCohort({
        record: { name: 'Cohort 2026', active: true },
      })
    ).toThrow('controller create failure');
  });
});
