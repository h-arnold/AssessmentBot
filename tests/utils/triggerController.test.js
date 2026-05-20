import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Global mock context - will be set up in beforeEach and torn down in afterEach
let restoreTriggerGlobals;

describe('backend TriggerController', () => {
  let TriggerController;
  let progressTracker;

  beforeEach(() => {
    vi.clearAllMocks();

    progressTracker = {
      logAndThrowError: vi.fn((message, error) => {
        throw error || new Error(message);
      }),
    };

    globalThis.ScriptApp = {
      AuthMode: { FULL: 'FULL' },
      requireScopes: vi.fn(),
      newTrigger: vi.fn(() => ({
        timeBased: vi.fn().mockReturnThis(),
        at: vi.fn().mockReturnThis(),
        create: vi.fn(() => ({ getUniqueId: vi.fn(() => 'trigger-1') })),
      })),
      getProjectTriggers: vi.fn(() => []),
      deleteTrigger: vi.fn(),
    };

    // Setup global mocks - saves originals and installs mocks
    const mockContext = withGlobalMocks({
      ProgressTracker: () => ({ getInstance: vi.fn(() => progressTracker) }),
      ScriptApp: () => globalThis.ScriptApp,
    });
    restoreTriggerGlobals = mockContext.restore;

    delete require.cache[require.resolve('../../src/backend/Utils/TriggerController.js')];
    ({ TriggerController } = require('../../src/backend/Utils/TriggerController.js'));
  });

  afterEach(() => {
    restoreTriggerGlobals();
  });

  it('does not expose removed on-open helper methods', () => {
    const controller = new TriggerController();

    expect(controller.createOnOpenTrigger).toBeUndefined();
    expect(controller.removeOnOpenTriggers).toBeUndefined();
  });

  it('still creates time-based triggers', () => {
    const controller = new TriggerController();

    const triggerId = controller.createTimeBasedTrigger('runTask');

    expect(globalThis.ScriptApp.requireScopes).toHaveBeenCalledWith(
      globalThis.ScriptApp.AuthMode.FULL,
      TriggerController.REQUIRED_SCOPES
    );
    expect(globalThis.ScriptApp.newTrigger).toHaveBeenCalledWith('runTask');
    expect(triggerId).toBe('trigger-1');
  });
});
