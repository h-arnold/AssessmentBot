import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuthorisationStatus } = require('../../src/backend/Api/auth.js');

describe('Api/auth.getAuthorisationStatus', () => {
  let originalScriptAppManager;

  beforeEach(() => {
    originalScriptAppManager = globalThis.ScriptAppManager;
  });

  afterEach(() => {
    if (originalScriptAppManager === undefined) {
      delete globalThis.ScriptAppManager;
    } else {
      globalThis.ScriptAppManager = originalScriptAppManager;
    }
    vi.restoreAllMocks();
  });

  it('creates ScriptAppManager and returns true when authorised', () => {
    const isAuthorised = vi.fn().mockReturnValue(true);
    const scriptAppManagerConstructor = vi.fn(function ScriptAppManagerMock() {
      this.isAuthorised = isAuthorised;
    });
    globalThis.ScriptAppManager = scriptAppManagerConstructor;

    const status = getAuthorisationStatus();

    expect(status).toBe(true);
    expect(scriptAppManagerConstructor).toHaveBeenCalledTimes(1);
    expect(isAuthorised).toHaveBeenCalledTimes(1);
  });

  it('creates ScriptAppManager and returns false when not authorised', () => {
    const isAuthorised = vi.fn().mockReturnValue(false);
    const scriptAppManagerConstructor = vi.fn(function ScriptAppManagerMock() {
      this.isAuthorised = isAuthorised;
    });
    globalThis.ScriptAppManager = scriptAppManagerConstructor;

    const status = getAuthorisationStatus();

    expect(status).toBe(false);
    expect(scriptAppManagerConstructor).toHaveBeenCalledTimes(1);
    expect(isAuthorised).toHaveBeenCalledTimes(1);
  });
});
