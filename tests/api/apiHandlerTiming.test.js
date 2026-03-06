import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiHandlerPath = '../../src/backend/Api/apiHandler.js';
const apiConstantsPath = '../../src/backend/Api/apiConstants.js';

function loadApiHandlerModule() {
  delete require.cache[require.resolve(apiHandlerPath)];
  return require(apiHandlerPath);
}

describe('Api/apiHandler – lock timing observability and logging', () => {
  let mockLock;
  let mockLoggerInstance;
  let infoSpy;
  let warnSpy;
  let originalABLogger;
  let originalLockService;
  let originalGetAuthorisationStatus;

  beforeEach(() => {
    globalThis.PropertiesService._resetUserProperties();

    vi.useFakeTimers();

    originalABLogger = globalThis.ABLogger;
    infoSpy = vi.fn();
    warnSpy = vi.fn();
    mockLoggerInstance = {
      debug: () => {},
      debugUi: () => {},
      info: infoSpy,
      warn: warnSpy,
      error: () => {},
      log: () => {},
    };
    globalThis.ABLogger = {
      getInstance: () => mockLoggerInstance,
    };

    originalLockService = globalThis.LockService;
    mockLock = { tryLock: vi.fn(() => true), releaseLock: vi.fn() };
    globalThis.LockService = {
      getUserLock: vi.fn(() => mockLock),
    };

    originalGetAuthorisationStatus = globalThis.getAuthorisationStatus;
    globalThis.getAuthorisationStatus = vi.fn(() => ({ authorised: true }));
  });

  afterEach(() => {
    globalThis.PropertiesService._resetUserProperties();

    vi.useRealTimers();

    globalThis.ABLogger = originalABLogger;

    if (originalLockService === undefined) {
      delete globalThis.LockService;
    } else {
      globalThis.LockService = originalLockService;
    }

    if (originalGetAuthorisationStatus === undefined) {
      delete globalThis.getAuthorisationStatus;
    } else {
      globalThis.getAuthorisationStatus = originalGetAuthorisationStatus;
    }

    vi.restoreAllMocks();
  });

  it('logs info with admission phase timing metadata after a successful request', () => {
    // Arrange: t0=1000, t1=1100 (after lock acquired, lockWaitMs=100),
    //          t2=1250 (after state mutation, stateUpdateMs=150, totalPhaseMs=250)
    let callCount = 0;
    const times = [1000, 1100, 1250];
    vi.spyOn(Date, 'now').mockImplementation(() => times[callCount++] ?? times[times.length - 1]);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    dispatcher.handle({ method: 'getAuthorisationStatus', params: {}, requestId: 'req-timing-1' });

    const admissionInfoCall = infoSpy.mock.calls.find(
      (args) => args[1] && args[1].phase === 'admission'
    );
    expect(admissionInfoCall).toBeDefined();
    const meta = admissionInfoCall[1];
    expect(meta).toMatchObject({
      phase: 'admission',
      requestId: 'req-timing-1',
      method: 'getAuthorisationStatus',
      lockWaitMs: 100,
      stateUpdateMs: 150,
      totalPhaseMs: 250,
    });
  });

  it('logs info with completion phase timing metadata after a successful request', () => {
    // Arrange: give distinct timing for each Date.now() call.
    // Admission uses indices 0–2, completion uses indices 3–5.
    let callCount = 0;
    const times = [1000, 1050, 1200, 2000, 2080, 2300];
    vi.spyOn(Date, 'now').mockImplementation(() => times[callCount++] ?? times[times.length - 1]);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    dispatcher.handle({ method: 'getAuthorisationStatus', params: {}, requestId: 'req-timing-2' });

    const completionInfoCall = infoSpy.mock.calls.find(
      (args) => args[1] && args[1].phase === 'completion'
    );
    expect(completionInfoCall).toBeDefined();
    const meta = completionInfoCall[1];
    expect(meta).toMatchObject({
      phase: 'completion',
      requestId: 'req-timing-2',
      method: 'getAuthorisationStatus',
      lockWaitMs: 80,
      stateUpdateMs: 220,
      totalPhaseMs: 300,
    });
  });

  it('logs warn (in addition to info) for admission phase when lockWaitMs exceeds LOCK_WAIT_WARN_THRESHOLD_MS', () => {
    const { LOCK_WAIT_WARN_THRESHOLD_MS } = require(apiConstantsPath);

    // lockWaitMs = threshold + 50, which should trigger the warn
    let callCount = 0;
    const lockWaitMs = LOCK_WAIT_WARN_THRESHOLD_MS + 50;
    const times = [0, lockWaitMs, lockWaitMs + 100];
    vi.spyOn(Date, 'now').mockImplementation(() => times[callCount++] ?? times[times.length - 1]);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    dispatcher.handle({ method: 'getAuthorisationStatus', params: {}, requestId: 'req-timing-3' });

    // info should still be called for the admission phase
    const admissionInfoCall = infoSpy.mock.calls.find(
      (args) => args[1] && args[1].phase === 'admission'
    );
    expect(admissionInfoCall).toBeDefined();

    // warn should have been called for the slow lock wait
    const admissionWarnCall = warnSpy.mock.calls.find(
      (args) => args[1] && args[1].phase === 'admission' && args[1].lockWaitMs !== undefined
    );
    expect(admissionWarnCall).toBeDefined();
    expect(admissionWarnCall[1].lockWaitMs).toBeGreaterThan(LOCK_WAIT_WARN_THRESHOLD_MS);
  });

  it('logs warn (in addition to info) for completion phase when lockWaitMs exceeds LOCK_WAIT_WARN_THRESHOLD_MS', () => {
    const { LOCK_WAIT_WARN_THRESHOLD_MS } = require(apiConstantsPath);

    // Admission uses normal timing; completion has a slow lock wait.
    let callCount = 0;
    const lockWaitMs = LOCK_WAIT_WARN_THRESHOLD_MS + 50;
    const times = [0, 50, 150, 1000, 1000 + lockWaitMs, 1000 + lockWaitMs + 100];
    vi.spyOn(Date, 'now').mockImplementation(() => times[callCount++] ?? times[times.length - 1]);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    dispatcher.handle({ method: 'getAuthorisationStatus', params: {}, requestId: 'req-timing-4' });

    const completionInfoCall = infoSpy.mock.calls.find(
      (args) => args[1] && args[1].phase === 'completion'
    );
    expect(completionInfoCall).toBeDefined();

    const completionWarnCall = warnSpy.mock.calls.find(
      (args) => args[1] && args[1].phase === 'completion' && args[1].lockWaitMs !== undefined
    );
    expect(completionWarnCall).toBeDefined();
    expect(completionWarnCall[1].lockWaitMs).toBeGreaterThan(LOCK_WAIT_WARN_THRESHOLD_MS);
  });

  it('does NOT log info for admission phase when tryLock returns false (lock never acquired)', () => {
    // LOCK_WAIT_WARN_THRESHOLD_MS must be defined before this behaviour is meaningful.
    const { LOCK_WAIT_WARN_THRESHOLD_MS } = require(apiConstantsPath);
    expect(LOCK_WAIT_WARN_THRESHOLD_MS).toBeDefined();

    mockLock.tryLock.mockReturnValue(false);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    dispatcher.handle({ method: 'getAuthorisationStatus', params: {}, requestId: 'req-timing-5' });

    const admissionInfoCall = infoSpy.mock.calls.find(
      (args) => args[1] && args[1].phase === 'admission'
    );
    expect(admissionInfoCall).toBeUndefined();
  });

  it('logs info for completion phase even when the handler produced an error', () => {
    globalThis.getAuthorisationStatus = vi.fn(() => {
      throw new Error('handler failure');
    });

    let callCount = 0;
    const times = [0, 50, 150, 1000, 1060, 1200];
    vi.spyOn(Date, 'now').mockImplementation(() => times[callCount++] ?? times[times.length - 1]);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const result = dispatcher.handle({
      method: 'getAuthorisationStatus',
      params: {},
      requestId: 'req-timing-6',
    });

    expect(result.ok).toBe(false);

    const completionInfoCall = infoSpy.mock.calls.find(
      (args) => args[1] && args[1].phase === 'completion'
    );
    expect(completionInfoCall).toBeDefined();
  });

  it('timing metadata does not include request params', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    dispatcher.handle({
      method: 'getAuthorisationStatus',
      params: { sensitiveData: 'should-not-appear' },
      requestId: 'req-timing-7',
    });

    for (const call of infoSpy.mock.calls) {
      const meta = call[1];
      if (meta && (meta.phase === 'admission' || meta.phase === 'completion')) {
        expect(meta).not.toHaveProperty('params');
        expect(meta).not.toHaveProperty('sensitiveData');
      }
    }

    // At least one timing info call must have been made for this assertion to be meaningful
    const timingInfoCalls = infoSpy.mock.calls.filter(
      (args) => args[1] && (args[1].phase === 'admission' || args[1].phase === 'completion')
    );
    expect(timingInfoCalls.length).toBeGreaterThan(0);
  });
});
