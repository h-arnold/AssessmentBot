/**
 * Unit tests for src/backend/z_Api/abclassMutations.js.
 * Verifies that unsafe classId path characters are rejected consistently for
 * upsert and update mutations.
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

describe('Api/abclassMutations classId validation', () => {
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

    const { upsertABClass } = loadAbclassMutationsModuleWithController(MockABClassController);

    expect(() =>
      upsertABClass({
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

    const { updateABClass } = loadAbclassMutationsModuleWithController(MockABClassController);

    expect(() =>
      updateABClass({
        classId,
      })
    ).toThrow(ApiValidationError);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
