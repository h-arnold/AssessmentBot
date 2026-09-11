/**
 * Transport-shape validation tests for `setAuthenticationSettings`.
 *
 * `setAuthenticationSettings_` rejects any non-object payload (`null`, arrays,
 * primitives) at the transport boundary with an `ApiValidationError` before the
 * domain save runs, so the standard `INVALID_REQUEST` envelope is returned and
 * no configuration write occurs.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  dispatchAuthApi,
  provisionAuthApiContext,
  rawStoreBlob,
  resetAuthApiTestState,
  teardownAuthApiTestContext,
} from './authApiTestHarness.js';
import { buildUsersJson } from '../utils/authService/authServiceTestHarness.js';

const ADMIN = 'admin@school.edu';

describe('setAuthenticationSettings — non-object payload rejection', () => {
  let ctx;

  beforeEach(() => {
    ctx = undefined;
    resetAuthApiTestState();
  });

  afterEach(() => {
    teardownAuthApiTestContext(ctx);
    ctx = undefined;
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'not-an-object'],
    ['a number', 42],
    ['a boolean', true],
  ])('rejects %s payload with INVALID_REQUEST and no write', (_label, params) => {
    ctx = provisionAuthApiContext({
      seed: {
        authMode: 'scriptProperties',
        authUsers: buildUsersJson([{ email: ADMIN, role: 'admin' }]),
        authRevision: '1',
      },
      email: ADMIN,
    });
    const before = rawStoreBlob(ctx.store);

    const response = dispatchAuthApi('setAuthenticationSettings', params);

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({ code: 'INVALID_REQUEST', retriable: false });
    expect(rawStoreBlob(ctx.store)).toBe(before);
    expect(ctx.configManager.writeConfigurationLocked).not.toHaveBeenCalled();
  });
});

describe('setAuthenticationSettings — unknown request field rejection', () => {
  let ctx;

  beforeEach(() => {
    ctx = undefined;
    resetAuthApiTestState();
  });

  afterEach(() => {
    teardownAuthApiTestContext(ctx);
    ctx = undefined;
  });

  it.each(['unexpected', 'authmode', 'users'])(
    'rejects the unknown field "%s" at the transport boundary before any domain save',
    (unknownField) => {
      ctx = provisionAuthApiContext({
        seed: {
          authMode: 'scriptProperties',
          authUsers: buildUsersJson([{ email: ADMIN, role: 'admin' }]),
          authRevision: '1',
        },
        email: ADMIN,
      });
      const before = rawStoreBlob(ctx.store);

      const response = dispatchAuthApi('setAuthenticationSettings', {
        authMode: 'scriptProperties',
        authUsers: [{ email: ADMIN, role: 'admin' }],
        expectedAuthRevision: '1',
        [unknownField]: 'x',
      });

      expect(response.ok).toBe(false);
      expect(response.error).toMatchObject({ code: 'INVALID_REQUEST', retriable: false });
      expect(response.error).not.toHaveProperty('details');
      expect(rawStoreBlob(ctx.store)).toBe(before);
      expect(ctx.configManager.writeConfigurationLocked).not.toHaveBeenCalled();
    }
  );
});
