/**
 * Focused regression test for the `getAuthenticationSettings` review finding:
 * the handler previously read raw `getAllConfigurations()` blob fields
 * (`stored.authUsers` / `stored.authRevision`) instead of the standard typed
 * ConfigurationManager getters. It must shape settings exclusively from the
 * typed accessor surface (`getAuthMode` / `getAuthGroupEmail` / `getAuthUsers` /
 * `getAuthRevision`), preserving the established validation/accessor boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuthenticationSettings_ } = require('../../src/backend/z_Api/apiAuth.js');

describe('getAuthenticationSettings transport — typed authentication-setting getters', () => {
  let originalConfigurationManager;
  let manager;

  beforeEach(() => {
    originalConfigurationManager = globalThis.ConfigurationManager;
    manager = {
      // Deliberately divergent raw-blob values prove the handler does NOT read
      // the raw blob when a typed getter exists.
      getAllConfigurations: vi.fn(() => ({
        authMode: 'scriptProperties',
        authGroupEmail: 'raw@school.edu',
        authUsers: JSON.stringify([{ email: 'raw@school.edu', role: 'user' }]),
        authRevision: '999',
      })),
      getAuthMode: vi.fn(() => 'scriptProperties'),
      getAuthGroupEmail: vi.fn(() => 'typed@school.edu'),
      getAuthUsers: vi.fn(() => JSON.stringify([{ email: 'admin@school.edu', role: 'admin' }])),
      getAuthRevision: vi.fn(() => '7'),
    };
    globalThis.ConfigurationManager = { getInstance: () => manager };
  });

  afterEach(() => {
    if (originalConfigurationManager === undefined) {
      delete globalThis.ConfigurationManager;
    } else {
      globalThis.ConfigurationManager = originalConfigurationManager;
    }
    vi.restoreAllMocks();
  });

  it('shapes scriptProperties settings from the typed getters, not the raw blob', () => {
    const result = getAuthenticationSettings_();

    expect(manager.getAuthMode).toHaveBeenCalledTimes(1);
    expect(manager.getAuthGroupEmail).toHaveBeenCalledTimes(1);
    expect(manager.getAuthUsers).toHaveBeenCalledTimes(1);
    expect(manager.getAuthRevision).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      authMode: 'scriptProperties',
      authGroupEmail: 'typed@school.edu',
      authUsers: [{ email: 'admin@school.edu', role: 'admin' }],
      authRevision: '7',
    });
  });

  it('maps an absent typed revision getter to null rather than an empty string', () => {
    manager.getAuthRevision.mockReturnValue('');

    expect(getAuthenticationSettings_().authRevision).toBeNull();
  });
});
