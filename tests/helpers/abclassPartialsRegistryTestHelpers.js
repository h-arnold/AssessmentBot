/**
 * Shared harness for the ABClassController partial-registry suites
 * (`abclass-controller-partials.test.js` and `abclass-roster-sync.test.js`).
 *
 * Both suites drive the controller over a dual-collection DbManager so writes to
 * a class collection and to the `abclass_partials` registry can be observed
 * independently. The router install and the per-suite collection/controller
 * bootstrap live here once; each suite keeps its own describes and assertions.
 */

import { vi } from 'vitest';
import {
  cleanupControllerTestMocks,
  createDualCollectionDbManager,
  createMockCollection,
  setupControllerTestMocks,
} from './mockFactories.js';

/**
 * Override globalThis.DbManager with a dual-collection router after
 * setupControllerTestMocks() has already set up ABLogger, ProgressTracker,
 * ConfigurationManager, and AssignmentDefinitionController.
 *
 * @param {object} classCollection - mock for the class-named collection
 * @param {object} partialsCollection - mock for the 'abclass_partials' collection
 * @returns {{ mockDbManager: object }} The installed mock DbManager.
 */
export function setupMocks(classCollection, partialsCollection) {
  const mockDbManager = createDualCollectionDbManager(vi, classCollection, partialsCollection);
  globalThis.DbManager = { getInstance: () => mockDbManager };
  return { mockDbManager };
}

/**
 * Builds the per-suite state shared by the partial-registry suites: fresh mock
 * collections, the controller test globals, the dual-collection router and the
 * controller and model owners loaded after those globals are in place.
 *
 * @returns {Promise<{ ABClassController: Function, ABClass: Function, classCollection: object, partialsCollection: object, mockABLogger: object }>}
 *   The loaded owners, mock collections and logger.
 */
export async function setupPartialRegistrySuite() {
  const classCollection = createMockCollection(vi);
  const partialsCollection = createMockCollection(vi);

  const mocks = setupControllerTestMocks(vi);

  setupMocks(classCollection, partialsCollection);

  // Dynamic import after globals are set (CommonJS modules read globals at call time)
  const abClassModule = await import('#backend/Models/ABClass.js');
  const controllerModule = await import('#backend/y_controllers/ABClassController/index.js');

  return {
    ABClassController: controllerModule.default ?? controllerModule,
    ABClass: abClassModule.ABClass,
    classCollection,
    partialsCollection,
    mockABLogger: mocks.mockABLogger,
  };
}

/**
 * Removes the controller test globals and restores spies after each suite.
 */
export function teardownPartialRegistrySuite() {
  cleanupControllerTestMocks();
  vi.restoreAllMocks();
}
