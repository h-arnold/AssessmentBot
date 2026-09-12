import { describe, expect, it } from 'vitest';

const { loadApiHandlerModule, EXPECTED_ALLOWLISTED_METHOD_HANDLER_KEYS } = require('./shared.js');
const { AUTH_API_METHOD_NAMES } = require('./authMethodNames.js');

describe('Api/apiHandler allowlisted method handler registry', () => {
  it('contains all expected API method keys in ALLOWLISTED_METHOD_HANDLERS', () => {
    const { ALLOWLISTED_METHOD_HANDLERS } = loadApiHandlerModule();

    expect(ALLOWLISTED_METHOD_HANDLERS).toBeTypeOf('object');
    expect(Object.keys(ALLOWLISTED_METHOD_HANDLERS)).toHaveLength(31);
    expect(ALLOWLISTED_METHOD_HANDLERS).toEqual(
      expect.objectContaining(
        Object.fromEntries(
          [...EXPECTED_ALLOWLISTED_METHOD_HANDLER_KEYS, ...AUTH_API_METHOD_NAMES].map(
            (methodName) => [methodName, expect.any(Function)]
          )
        )
      )
    );
  });

  it('registers the three auth endpoints (getApplicationAccess plus the admin-only settings pair)', () => {
    const { ALLOWLISTED_METHOD_HANDLERS } = loadApiHandlerModule();

    expect(ALLOWLISTED_METHOD_HANDLERS.getApplicationAccess).toBeTypeOf('function');
    expect(ALLOWLISTED_METHOD_HANDLERS.getAuthenticationSettings).toBeTypeOf('function');
    expect(ALLOWLISTED_METHOD_HANDLERS.setAuthenticationSettings).toBeTypeOf('function');
  });
});
