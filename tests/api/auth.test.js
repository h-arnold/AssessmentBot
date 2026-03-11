import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';

const { getAuthorisationStatus } = require('../../src/backend/z_Api/auth.js');

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

  it('works when module exports are unavailable in the runtime context', () => {
    const filePath = path.resolve(__dirname, '../../src/backend/z_Api/auth.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const isAuthorised = vi.fn().mockReturnValue(true);
    const context = {
      ScriptAppManager: function ScriptAppManagerMock() {
        this.isAuthorised = isAuthorised;
      },
    };

    vm.runInNewContext(source, context, { filename: filePath });

    expect(context.getAuthorisationStatus()).toBe(true);
    expect(isAuthorised).toHaveBeenCalledTimes(1);
  });
});
