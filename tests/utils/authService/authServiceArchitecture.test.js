/**
 * Provider architecture contract tests.
 *
 * Encodes the intended public/factory surface of the AuthService refactor:
 * AuthService.getInstance() remains the sole caller entrypoint, and the two
 * provider subclasses exist as global classes extending the base. Tests reach
 * the providers through globalThis only (mirroring the GAS concatenated
 * runtime), so the implementation may choose order-safe file names under
 * src/backend/Utils/.
 */
import { describe, it, expect } from 'vitest';

const AuthService = require('../../../src/backend/Utils/AuthService.js');

describe('AuthService provider architecture', () => {
  it('keeps AuthService.getInstance() as the sole caller entrypoint', () => {
    expect(typeof AuthService.getInstance).toBe('function');
    expect(AuthService.getInstance()).toBe(AuthService.getInstance());
  });

  it('exposes GoogleGroupsAuthService as a global subclass of AuthService', () => {
    const GoogleGroupsAuthService = globalThis.GoogleGroupsAuthService;
    expect(GoogleGroupsAuthService).toBeDefined();
    expect(Object.getPrototypeOf(GoogleGroupsAuthService)).toBe(AuthService);
  });

  it('exposes ScriptPropertiesAuthService as a global subclass of AuthService', () => {
    const ScriptPropertiesAuthService = globalThis.ScriptPropertiesAuthService;
    expect(ScriptPropertiesAuthService).toBeDefined();
    expect(Object.getPrototypeOf(ScriptPropertiesAuthService)).toBe(AuthService);
  });
});
