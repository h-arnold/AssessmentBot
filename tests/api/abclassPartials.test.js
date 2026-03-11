/**
 * Section 5 – API allowlist and dispatcher wiring for getABClassPartials.
 *
 * Tests:
 *  1. API_METHODS exposes getABClassPartials.
 *  2. API_ALLOWLIST maps getABClassPartials correctly.
 *  3. Allowlisted method dispatches to the getABClassPartials handler.
 *  4. Success envelope contains returned data.
 *  5. Unknown method still returns UNKNOWN_METHOD.
 *  6. Controller-thrown error maps to expected failure envelope.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiConstantsPath = '../../src/backend/z_Api/apiConstants.js';
const apiHandlerPath = '../../src/backend/z_Api/apiHandler.js';

const {
  loadApiHandlerModule,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
} = require('../helpers/apiHandlerTestUtils.js');

function loadApiConstantsModule() {
  delete require.cache[require.resolve(apiConstantsPath)];
  return require(apiConstantsPath);
}

// ─── Section 5.1 – Constants ─────────────────────────────────────────────────

describe('Api/apiConstants – getABClassPartials', () => {
  it('API_METHODS exposes getABClassPartials', () => {
    const { API_METHODS } = loadApiConstantsModule();
    expect(API_METHODS.getABClassPartials).toBe('getABClassPartials');
  });

  it('API_ALLOWLIST maps getABClassPartials to itself', () => {
    const { API_ALLOWLIST } = loadApiConstantsModule();
    expect(API_ALLOWLIST.getABClassPartials).toBe('getABClassPartials');
  });
});

// ─── Section 5.2 – Dispatcher ────────────────────────────────────────────────

describe('Api/apiHandler – getABClassPartials dispatch', () => {
  let context;
  let originalGetABClassPartials;

  beforeEach(() => {
    context = setupApiHandlerTestContext(vi);

    // Install a stub global for getABClassPartials (mirrors the pattern used for
    // getAuthorisationStatus). The handler function lives in the GAS global scope
    // at runtime; in tests we set it on globalThis directly.
    originalGetABClassPartials = globalThis.getABClassPartials;
    globalThis.getABClassPartials = vi.fn(() => [{ classId: 'c1', className: 'Test Class' }]);
  });

  afterEach(() => {
    teardownApiHandlerTestContext(vi, context);

    // Restore original (likely undefined) global
    if (originalGetABClassPartials === undefined) {
      delete globalThis.getABClassPartials;
    } else {
      globalThis.getABClassPartials = originalGetABClassPartials;
    }
  });

  it('dispatches getABClassPartials to the global handler and returns a success envelope', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({ method: 'getABClassPartials' });

    expect(response.ok).toBe(true);
    expect(response.data).toEqual([{ classId: 'c1', className: 'Test Class' }]);
    expect(globalThis.getABClassPartials).toHaveBeenCalledTimes(1);
  });

  it('success envelope contains the array returned by the handler', () => {
    const partials = [
      { classId: 'c1', className: 'Class A', active: true },
      { classId: 'c2', className: 'Class B', active: false },
    ];
    globalThis.getABClassPartials = vi.fn(() => partials);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({ method: 'getABClassPartials' });

    expect(response).toMatchObject({ ok: true, data: partials });
  });

  it('unknown method still returns UNKNOWN_METHOD', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({ method: 'notARealMethod' });

    expect(response.ok).toBe(false);
    expect(response.error.code).toBe('UNKNOWN_METHOD');
  });

  it('maps a controller-thrown error to a failure envelope', () => {
    globalThis.getABClassPartials = vi.fn(() => {
      throw new Error('DB read failure');
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({ method: 'getABClassPartials' });

    expect(response.ok).toBe(false);
    expect(response.error.code).toBe('INTERNAL_ERROR');
  });
});
