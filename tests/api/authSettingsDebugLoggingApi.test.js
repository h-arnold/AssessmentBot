/**
 * Transport debug-logging tests for `setAuthenticationSettings`.
 *
 * The authentication-settings save payload is an authorised-user email list
 * (PII). The dispatcher must omit both the request and response bodies for this
 * method from its debug logs while retaining the method name for traceability.
 * The read endpoint (`getAuthenticationSettings`) is intentionally out of scope
 * for this control.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  dispatchAuthApi,
  provisionAuthApiContext,
  resetAuthApiTestState,
  teardownAuthApiTestContext,
} from './authApiTestHarness.js';
import { buildUsersJson } from '../utils/authService/authServiceTestHarness.js';

const ADMIN = 'admin@school.edu';
const USER = 'user@school.edu';

describe('setAuthenticationSettings — debug-log payload omission', () => {
  let ctx;

  beforeEach(() => {
    ctx = undefined;
    resetAuthApiTestState();
  });

  afterEach(() => {
    teardownAuthApiTestContext(ctx);
    ctx = undefined;
  });

  it('omits the request and response bodies from transport debug logs (PII safety)', () => {
    ctx = provisionAuthApiContext({
      seed: {
        authMode: 'scriptProperties',
        authUsers: buildUsersJson([{ email: ADMIN, role: 'admin' }]),
        authRevision: '1',
      },
      email: ADMIN,
    });

    const response = dispatchAuthApi('setAuthenticationSettings', {
      authMode: 'scriptProperties',
      authUsers: [
        { email: ADMIN, role: 'admin' },
        { email: USER, role: 'user' },
      ],
      expectedAuthRevision: '1',
    });

    expect(response.ok).toBe(true);
    const debugPayload = ctx.logger.debug.mock.calls.map((args) => JSON.stringify(args)).join('\n');
    // The authorised-user email list must never reach the debug logs.
    expect(debugPayload).not.toContain(USER);
    expect(debugPayload).not.toContain('authUsers');
    // Traceability is retained: the method is still recorded.
    expect(
      ctx.logger.debug.mock.calls.some((args) => args[1]?.method === 'setAuthenticationSettings')
    ).toBe(true);
  });
});
