/**
 * Tests for the TriggerController trigger-context storage methods and the
 * createTimeBasedTrigger recovery path (ACTION_PLAN Section 8).
 *
 * The controller now lives at src/backend/Triggers/TriggerController.js (moved
 * from src/backend/Utils/TriggerController.js) and exposes the context storage
 * methods storeTriggerContext(), getTriggerContext() and clearTriggerContext()
 * alongside the existing createTimeBasedTrigger(), removeTriggers() and
 * deleteTriggerById() instance methods.
 *
 * The too-many-triggers recovery path removes triggers pointing at the single
 * public entrypoint (triggerHandler), not the deleted legacy
 * triggerProcessSelectedAssignment wrapper.
 *
 * The storage seam is the real GASPropertiesUtils global (registered in
 * tests/setupGlobals.js): getTriggerContext() reads each key directly via
 * GASPropertiesUtils.getScriptProperties().getProperty(key) (there is no
 * single-key getter wrapper), and clearTriggerContext() removes both keys via
 * GASPropertiesUtils.clearProperties(properties, keys). Keys follow the
 * trigger-context.md shape: `trigger:<uid>:method` and `trigger:<uid>:params`
 * (JSON-serialised).
 *
 * This file also carries the legacy tests merged in from
 * tests/utils/triggerController.test.js (the controller does not expose the
 * removed on-open helper methods, and createTimeBasedTrigger still works),
 * whose assertions are preserved unchanged.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// The controller was moved from src/backend/Utils/ to src/backend/Triggers/
// during the green/refactor phase (ACTION_PLAN Section 8).
const TRIGGER_CONTROLLER_PATH = '../../src/backend/Triggers/TriggerController.js';

describe('TriggerController', () => {
  let TriggerController;
  let scriptPropertiesData;
  let scriptPropertiesMock;
  let restoreTriggerGlobals;

  beforeEach(() => {
    vi.clearAllMocks();

    // Fresh in-memory Script Properties store for each test, mirroring the
    // PropertiesService mock pattern used by tests/api/requestStore.test.js.
    scriptPropertiesData = {};
    scriptPropertiesMock = {
      getProperty: vi.fn((key) =>
        Object.hasOwn(scriptPropertiesData, key) ? scriptPropertiesData[key] : null
      ),
      setProperty: vi.fn((key, value) => {
        scriptPropertiesData[key] = value;
      }),
      deleteProperty: vi.fn((key) => {
        delete scriptPropertiesData[key];
      }),
      getKeys: vi.fn(() => Object.keys(scriptPropertiesData)),
    };

    // Spy on the real GASPropertiesUtils global so the context methods are
    // observed at the canonical storage seam. clearProperties() calls through
    // to the real implementation so deleteProperty() runs against the store.
    vi.spyOn(globalThis.GASPropertiesUtils, 'getScriptProperties').mockReturnValue(
      scriptPropertiesMock
    );
    vi.spyOn(globalThis.GASPropertiesUtils, 'clearProperties');

    // ScriptApp mock used by the too-many-triggers recovery test and the merged
    // "still creates time-based triggers" legacy test, mirroring
    // tests/utils/triggerController.test.js. Installed through the
    // withGlobalMocks factory (which installs the factory result on globalThis
    // and snapshots the real global as the restore target) so the original
    // global is always restored (globalMockManager pattern). The mock must NOT
    // be pre-assigned to globalThis: that would snapshot the mock itself as the
    // "original" and restore() would leak the mock into later suites.
    const scriptAppMock = {
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
    const mockContext = withGlobalMocks({ ScriptApp: () => scriptAppMock });
    restoreTriggerGlobals = mockContext.restore;

    delete require.cache[require.resolve(TRIGGER_CONTROLLER_PATH)];
    ({ TriggerController } = require(TRIGGER_CONTROLLER_PATH));
  });

  afterEach(() => {
    if (restoreTriggerGlobals) restoreTriggerGlobals();
    vi.restoreAllMocks();
  });

  it('stores the method and JSON-serialised params under the namespaced Script Properties keys', () => {
    const controller = new TriggerController();
    const params = {
      assignmentId: 'assignment-456',
      definitionKey: 'Essay_1_defKey',
      courseId: 'course-123',
    };

    controller.storeTriggerContext('trigger-uid-1', {
      method: 'processSelectedAssignment',
      params,
    });

    expect(scriptPropertiesMock.setProperty).toHaveBeenCalledWith(
      'trigger:trigger-uid-1:method',
      'processSelectedAssignment'
    );
    expect(scriptPropertiesMock.setProperty).toHaveBeenCalledWith(
      'trigger:trigger-uid-1:params',
      JSON.stringify(params)
    );
  });

  it('retrieves the stored method and deserialised params', () => {
    const controller = new TriggerController();
    const params = {
      assignmentId: 'assignment-456',
      definitionKey: 'Essay_1_defKey',
      courseId: 'course-123',
    };
    controller.storeTriggerContext('trigger-uid-2', {
      method: 'processSelectedAssignment',
      params,
    });

    const context = controller.getTriggerContext('trigger-uid-2');

    expect(context).toEqual({ method: 'processSelectedAssignment', params });
    // Both keys must be read directly from the Script Properties store.
    expect(scriptPropertiesMock.getProperty).toHaveBeenCalledWith('trigger:trigger-uid-2:method');
    expect(scriptPropertiesMock.getProperty).toHaveBeenCalledWith('trigger:trigger-uid-2:params');
  });

  it('returns null when the triggerUid is unknown', () => {
    const controller = new TriggerController();

    expect(controller.getTriggerContext('unknown-trigger')).toBeNull();
  });

  it('returns a partial context when only the method key exists', () => {
    const controller = new TriggerController();
    scriptPropertiesMock.setProperty('trigger:partial-uid:method', 'processSelectedAssignment');

    expect(controller.getTriggerContext('partial-uid')).toEqual({
      method: 'processSelectedAssignment',
      params: null,
    });
  });

  it('returns a partial context when only the params key exists', () => {
    const controller = new TriggerController();
    const params = {
      assignmentId: 'assignment-456',
      definitionKey: 'Essay_1_defKey',
      courseId: 'course-123',
    };
    scriptPropertiesMock.setProperty('trigger:partial-params-uid:params', JSON.stringify(params));

    expect(controller.getTriggerContext('partial-params-uid')).toEqual({
      method: null,
      params,
    });
  });

  it('returns null when the stored params JSON is malformed', () => {
    const controller = new TriggerController();
    scriptPropertiesMock.setProperty('trigger:malformed-uid:method', 'processSelectedAssignment');
    scriptPropertiesMock.setProperty('trigger:malformed-uid:params', 'not-valid-json{{{');

    expect(controller.getTriggerContext('malformed-uid')).toBeNull();
  });

  it('removes both context keys when clearing a trigger', () => {
    const controller = new TriggerController();
    controller.storeTriggerContext('trigger-uid-3', {
      method: 'processSelectedAssignment',
      params: { assignmentId: 'a1', definitionKey: 'k1', courseId: 'c1' },
    });

    controller.clearTriggerContext('trigger-uid-3');

    // GASPropertiesUtils.clearProperties iterates the keys in order, so green
    // may legitimately build the keys array in either order — assert
    // order-insensitively.
    expect(globalThis.GASPropertiesUtils.clearProperties).toHaveBeenCalledTimes(1);
    const [propertiesArg, keysArg] = globalThis.GASPropertiesUtils.clearProperties.mock.calls[0];
    expect(propertiesArg).toBe(scriptPropertiesMock);
    expect(keysArg).toHaveLength(2);
    expect(keysArg).toEqual(
      expect.arrayContaining(['trigger:trigger-uid-3:method', 'trigger:trigger-uid-3:params'])
    );
    expect(scriptPropertiesMock.deleteProperty).toHaveBeenCalledWith(
      'trigger:trigger-uid-3:method'
    );
    expect(scriptPropertiesMock.deleteProperty).toHaveBeenCalledWith(
      'trigger:trigger-uid-3:params'
    );
    expect(scriptPropertiesData).toEqual({});
  });

  it('keeps concurrent trigger contexts isolated by triggerUid', () => {
    const controller = new TriggerController();
    const paramsA = {
      assignmentId: 'assignment-a',
      definitionKey: 'key-a',
      courseId: 'course-a',
    };
    const paramsB = {
      assignmentId: 'assignment-b',
      definitionKey: 'key-b',
      courseId: 'course-b',
    };

    controller.storeTriggerContext('trigger-uid-a', {
      method: 'processSelectedAssignment',
      params: paramsA,
    });
    controller.storeTriggerContext('trigger-uid-b', {
      method: 'processSelectedAssignment',
      params: paramsB,
    });

    expect(controller.getTriggerContext('trigger-uid-a')).toEqual({
      method: 'processSelectedAssignment',
      params: paramsA,
    });
    expect(controller.getTriggerContext('trigger-uid-b')).toEqual({
      method: 'processSelectedAssignment',
      params: paramsB,
    });

    // Clearing one trigger must not affect the other trigger's context.
    controller.clearTriggerContext('trigger-uid-a');
    expect(controller.getTriggerContext('trigger-uid-b')).toEqual({
      method: 'processSelectedAssignment',
      params: paramsB,
    });
    expect(controller.getTriggerContext('trigger-uid-a')).toBeNull();
  });

  it('uses ABLogger for all logging and leaves no console.* calls in the source', () => {
    // Strongest hermetic seam: scan the production source text directly. The
    // green phase converts the file's existing console.log/console.warn calls
    // to ABLogger.getInstance() — this assertion fails while console.* remains.
    const source = fs.readFileSync(require.resolve(TRIGGER_CONTROLLER_PATH), 'utf8');

    expect(source).not.toMatch(/\bconsole\.(log|info|warn|error|debug)\b/);
    expect(source).toMatch(/ABLogger\.getInstance\(\)/);
  });

  it('uses triggerHandler as the removal target when too many triggers error occurs', () => {
    const newTriggerChain = {
      timeBased: vi.fn().mockReturnThis(),
      at: vi.fn().mockReturnThis(),
      create: vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('This script has too many triggers');
        })
        .mockImplementationOnce(() => ({ getUniqueId: vi.fn(() => 'trigger-recovery-1') })),
    };
    globalThis.ScriptApp.newTrigger.mockReturnValue(newTriggerChain);
    const removeTriggersSpy = vi.spyOn(TriggerController.prototype, 'removeTriggers');

    const controller = new TriggerController();
    const triggerId = controller.createTimeBasedTrigger('runTask');

    // Section 8 acceptance criterion: the recovery path must remove triggers
    // pointing at the new single public entrypoint (triggerHandler), not the
    // deleted legacy triggerProcessSelectedAssignment wrapper.
    expect(removeTriggersSpy).toHaveBeenCalledWith('triggerHandler');
    expect(removeTriggersSpy).not.toHaveBeenCalledWith('triggerProcessSelectedAssignment');
    expect(triggerId).toBe('trigger-recovery-1');
  });

  // Tests merged from tests/utils/triggerController.test.js (assertions
  // preserved unchanged) — the shared beforeEach ScriptApp mock already covers
  // what these need.
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
