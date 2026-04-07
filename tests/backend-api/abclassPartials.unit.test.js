/**
 * Unit tests for src/backend/z_Api/abclassPartials.js.
 * Verifies the handler still delegates through the normal harness global and
 * that the production file does not retain top-of-file Node compatibility wiring.
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const modulePath = '../../src/backend/z_Api/abclassPartials.js';

function loadAbclassPartialsModule() {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

describe('Api/abclassPartials delegation', () => {
  const originalABClassController = globalThis.ABClassController;

  afterEach(() => {
    if (originalABClassController === undefined) {
      delete globalThis.ABClassController;
    } else {
      globalThis.ABClassController = originalABClassController;
    }

    vi.restoreAllMocks();
  });

  it('getABClassPartials() constructs the harness-provided controller and delegates to getAllClassPartials()', () => {
    const partials = [{ classId: 'cX', className: 'Delegated' }];
    const getAllClassPartials = vi.fn(() => partials);

    globalThis.ABClassController = vi.fn(function StubABClassController() {
      this.getAllClassPartials = getAllClassPartials;
    });

    const { getABClassPartials } = loadAbclassPartialsModule();

    expect(getABClassPartials()).toEqual(partials);
    expect(globalThis.ABClassController).toHaveBeenCalledTimes(1);
    expect(getAllClassPartials).toHaveBeenCalledTimes(1);
  });
});

describe('Api/abclassPartials source contract', () => {
  it('does not keep top-of-file Node compatibility require wiring for ABClassController', () => {
    const source = readFileSync(new URL(modulePath, import.meta.url), 'utf8');

    expect(source).not.toMatch(/require\('\.\.\/y_controllers\/ABClassController\.js'\)/);
    expect(source).not.toMatch(/let\s+ControllerCtor;/);
  });
});
