/**
 * Unit test for src/backend/Api/abclassPartials.js
 * Verifies that the API handler delegates to ABClassController.getAllClassPartials().
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Api/abclassPartials – direct unit delegation test', () => {
  const modulePath = '../../src/backend/Api/abclassPartials.js';
  let originalController;

  beforeEach(() => {
    // Stub controller on global so the module under test uses it.
    originalController = globalThis.ABClassController;
    // Use a constructable function (not arrow) so `new` works.
    const ctor = vi.fn(function StubController() {
      this.getAllClassPartials = vi.fn(() => [{ classId: 'cX', className: 'Delegated' }]);
    });
    globalThis.ABClassController = ctor;
  });

  afterEach(() => {
    if (originalController === undefined) delete globalThis.ABClassController;
    else globalThis.ABClassController = originalController;
    vi.restoreAllMocks();
  });

  it('getABClassPartials() constructs ABClassController and calls getAllClassPartials()', () => {
    // Fresh import so it picks up our stubbed global
    // eslint-disable-next-line global-require
    delete require.cache[require.resolve(modulePath)];
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const api = require(modulePath);

    const result = api.getABClassPartials();

    // Constructor should have been invoked exactly once
    expect(globalThis.ABClassController).toHaveBeenCalledTimes(1);
    // The returned value should match the stubbed implementation
    expect(result).toEqual([{ classId: 'cX', className: 'Delegated' }]);
  });
});
