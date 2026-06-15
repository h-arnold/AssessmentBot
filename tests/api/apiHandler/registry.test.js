import { describe, expect, it } from 'vitest';

const { loadApiHandlerModule, EXPECTED_ALLOWLISTED_METHOD_HANDLER_KEYS } = require('./shared.js');

describe('Api/apiHandler allowlisted method handler registry', () => {
  it('contains all expected API method keys in ALLOWLISTED_METHOD_HANDLERS', () => {
    const { ALLOWLISTED_METHOD_HANDLERS } = loadApiHandlerModule();

    expect(ALLOWLISTED_METHOD_HANDLERS).toBeTypeOf('object');
    expect(Object.keys(ALLOWLISTED_METHOD_HANDLERS)).toHaveLength(27);
    expect(ALLOWLISTED_METHOD_HANDLERS).toEqual(
      expect.objectContaining(
        Object.fromEntries(
          EXPECTED_ALLOWLISTED_METHOD_HANDLER_KEYS.map((methodName) => [
            methodName,
            expect.any(Function),
          ])
        )
      )
    );
  });
});
