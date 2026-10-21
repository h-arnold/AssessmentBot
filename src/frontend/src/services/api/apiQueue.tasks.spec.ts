import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createGoogleScriptRunApiHandlerMock } from '@/test/googleScriptRunHarness';
import {
  clearGoogle,
  loadApiQueue,
  loadCallApi,
  setGoogle,
} from '@/test/api/apiServiceTransportTestHelpers';

type DeferredTaskQueue = Awaited<ReturnType<typeof loadApiQueue>> & {
  runApiQueuedTask: <T>(jobName: string, task: () => T | Promise<T>) => Promise<T>;
};

const READ_VALUE = 2;
const MERGED_VALUE = READ_VALUE + 1;
const ORDINARY_VALUE = 4;
const TWO_PENDING_ENTRIES = 2;

/**
 * Loads the actual owner and fails explicitly at the missing RED-phase capability.
 * @returns {Promise<DeferredTaskQueue>} The actual queue exports with the required local-task contract.
 */
async function loadTaskQueue(): Promise<DeferredTaskQueue> {
  const queue = await loadApiQueue();
  expect(queue, 'apiQueue must export the local deferred-task API').toHaveProperty(
    'runApiQueuedTask',
    expect.any(Function)
  );
  // Deliberate RED type error until the actual queue owner implements this API.
  return queue;
}

/**
 * Installs scalar transport probes; only explicitly blocked methods await release.
 * @param {string[]} events Ordered dispatch markers.
 * @param {readonly string[]} blockedMethods Methods held until explicitly released by the test.
 * @returns {Promise<{ dispatch: ReturnType<typeof vi.fn>; releases: Map<string, () => void> }>} Dispatch observation and per-method release callbacks.
 */
async function installScalarTransport(events: string[], blockedMethods: readonly string[]) {
  const { ApiRequestSchema } = await import('@/services/apiService');
  const releases = new Map<string, () => void>();
  const dispatch = vi.fn((request: unknown) => {
    const parsed = ApiRequestSchema.parse(request);
    events.push(parsed.method);
    return parsed;
  });
  const runner = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
    const parsed = dispatch(request);
    const release = () => {
      callbacks.successHandler?.({ ok: true, requestId: parsed.method, data: parsed.params });
    };
    if (blockedMethods.includes(parsed.method)) {
      releases.set(parsed.method, release);
    } else {
      release();
    }
  });
  setGoogle({ script: { run: runner } });
  return { dispatch, releases };
}

describe('runApiQueuedTask local deferred operations', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.resetModules();
    clearGoogle();
  });

  it('reserves the complete read, await, merge and write slot before later same-job calls', async () => {
    const queue = await loadTaskQueue();
    const callApi = await loadCallApi();
    const events: string[] = [];
    const { dispatch, releases } = await installScalarTransport(events, ['read', 'write']);
    const mergeGate = Promise.withResolvers<void>();
    const readFinished = Promise.withResolvers<void>();
    const writeStarted = Promise.withResolvers<void>();

    const operation = queue.runApiQueuedTask('classesBulkMutation', async () => {
      const value = await callApi<number>('read', READ_VALUE);
      events.push('read-finished');
      readFinished.resolve();
      await mergeGate.promise;
      events.push('merge');
      const writing = callApi<number>('write', value + 1);
      writeStarted.resolve();
      return writing;
    });
    const ordinary = queue.callApiQueued<number>('ordinary', ORDINARY_VALUE, 'classesBulkMutation');
    expect(events).toEqual(['read']);
    expect(queue.getQueueState('classesBulkMutation')).toEqual({ pending: 1, active: true });

    releases.get('read')!();
    await readFinished.promise;
    expect(events).toEqual(['read', 'read-finished']);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(queue.getQueueState('classesBulkMutation')).toEqual({ pending: 1, active: true });

    mergeGate.resolve();
    await writeStarted.promise;
    expect(events).toEqual(['read', 'read-finished', 'merge', 'write']);
    expect(queue.getQueueState('classesBulkMutation')).toEqual({ pending: 1, active: true });
    releases.get('write')!();
    await expect(operation).resolves.toBe(MERGED_VALUE);
    await expect(ordinary).resolves.toBe(ORDINARY_VALUE);
    expect(events).toEqual(['read', 'read-finished', 'merge', 'write', 'ordinary']);
    expect(dispatch.mock.calls.map(([request]) => request)).toEqual([
      { method: 'read', params: 2 },
      { method: 'write', params: 3 },
      { method: 'ordinary', params: 4 },
    ]);
    expect(queue.getQueueState('classesBulkMutation')).toEqual({ pending: 0, active: false });
  });

  it('defers callbacks behind ordinary calls and preserves mixed FIFO order and snapshots', async () => {
    const queue = await loadTaskQueue();
    const events: string[] = [];
    const { releases } = await installScalarTransport(events, ['first', 'last']);
    const taskGate = Promise.withResolvers<string>();
    const taskStarted = Promise.withResolvers<void>();
    const task = vi.fn(() => {
      events.push('task');
      taskStarted.resolve();
      return taskGate.promise;
    });
    const first = queue.callApiQueued('first', 1, 'mixed');
    const middle = queue.runApiQueuedTask('mixed', task);
    const last = queue.callApiQueued('last', 1, 'mixed');
    expect(task).not.toHaveBeenCalled();
    expect(queue.getQueueState('mixed')).toEqual({ pending: 2, active: true });

    releases.get('first')!();
    await first;
    await taskStarted.promise;
    expect(events).toEqual(['first', 'task']);
    expect(queue.getQueueState('mixed')).toEqual({ pending: 1, active: true });
    taskGate.resolve('middle');
    await expect(middle).resolves.toBe('middle');
    expect(events).toEqual(['first', 'task', 'last']);
    expect(queue.getQueueState('mixed')).toEqual({ pending: 0, active: true });
    releases.get('last')!();
    await last;
    expect(queue.getQueueState('mixed')).toEqual({ pending: 0, active: false });
  });

  it('marks active synchronously and serialises consecutive local tasks', async () => {
    const queue = await loadTaskQueue();
    const gate = Promise.withResolvers<number>();
    const secondTask = vi.fn(() => 0);
    const first = queue.runApiQueuedTask('local', () => gate.promise);
    expect(queue.getQueueState('local')).toEqual({ pending: 0, active: true });
    const snapshot = queue.getQueueState('local');
    const second = queue.runApiQueuedTask('local', secondTask);
    expect(secondTask).not.toHaveBeenCalled();
    expect(queue.getQueueState('local')).toEqual({ pending: 1, active: true });
    expect(snapshot).toEqual({ pending: 0, active: true });
    gate.resolve(1);
    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(0);
    expect(secondTask).toHaveBeenCalledTimes(1);
    expect(queue.getQueueState('local')).toEqual({ pending: 0, active: false });
  });

  it('runs another job task and ordinary call while the first job remains active', async () => {
    const queue = await loadTaskQueue();
    const gate = Promise.withResolvers<string>();
    const events: string[] = [];
    await installScalarTransport(events, []);
    const held = queue.runApiQueuedTask('held', () => gate.promise);
    const independent = queue.runApiQueuedTask('independent', () => 'independent-result');
    const ordinary = queue.callApiQueued('parallel', 1, 'transport-job');
    await expect(independent).resolves.toBe('independent-result');
    await expect(ordinary).resolves.toBe(1);
    expect(queue.getQueueState('held')).toEqual({ pending: 0, active: true });
    expect(events).toEqual(['parallel']);
    gate.resolve('held-result');
    await expect(held).resolves.toBe('held-result');
  });

  it.each(['synchronous throw', 'asynchronous rejection'] as const)(
    'releases the lane after %s and preserves the original failure',
    async (failureMode) => {
      const queue = await loadTaskQueue();
      const events: string[] = [];
      await installScalarTransport(events, []);
      const gate = Promise.withResolvers<void>();
      const failure = new Error(failureMode);
      const blocker = queue.runApiQueuedTask('failure', () => gate.promise);
      const failing = queue.runApiQueuedTask('failure', () => {
        if (failureMode === 'synchronous throw') throw failure;
        return Promise.reject(failure);
      });
      const rejection = expect(failing).rejects.toBe(failure);
      const ordinary = queue.callApiQueued('after-failure', 1, 'failure');
      const following = queue.runApiQueuedTask('failure', () => 'recovered');
      gate.resolve();
      await blocker;
      await rejection;
      await expect(ordinary).resolves.toBe(1);
      await expect(following).resolves.toBe('recovered');
      expect(events).toEqual(['after-failure']);
      expect(queue.getQueueState('failure')).toEqual({ pending: 0, active: false });
    }
  );

  it('cancels pending mixed entries without executing them or aborting the active task', async () => {
    const queue = await loadTaskQueue();
    const events: string[] = [];
    const { dispatch } = await installScalarTransport(events, []);
    const gate = Promise.withResolvers<string>();
    const active = queue.runApiQueuedTask('cancel', () => gate.promise);
    const pendingTask = vi.fn(() => 'must-not-run');
    const task = queue.runApiQueuedTask('cancel', pendingTask);
    const ordinary = queue.callApiQueued('must-not-dispatch', 1, 'cancel');
    const taskRejection = expect(task).rejects.toEqual({ reason: 'CANCELLED' });
    const ordinaryRejection = expect(ordinary).rejects.toEqual({ reason: 'CANCELLED' });
    expect(queue.getQueueState('cancel')).toEqual({ pending: 2, active: true });
    expect(queue.cancelApiQueued('cancel')).toBe(TWO_PENDING_ENTRIES);
    expect(queue.cancelApiQueued('cancel')).toBe(0);
    expect(queue.getQueueState('cancel')).toEqual({ pending: 0, active: true });
    await taskRejection;
    await ordinaryRejection;
    expect(pendingTask).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    gate.resolve('active-completed');
    await expect(active).resolves.toBe('active-completed');
    expect(queue.getQueueState('cancel')).toEqual({ pending: 0, active: false });
    await expect(queue.runApiQueuedTask('cancel', () => 'reused')).resolves.toBe('reused');
    expect(pendingTask).not.toHaveBeenCalled();
  });

  it('cancels a pending task behind an active ordinary request without aborting that request', async () => {
    const queue = await loadTaskQueue();
    const events: string[] = [];
    const { releases } = await installScalarTransport(events, ['active-request']);
    const active = queue.callApiQueued('active-request', 1, 'cancel-request');
    const callback = vi.fn(() => 0);
    const pending = queue.runApiQueuedTask('cancel-request', callback);
    const rejection = expect(pending).rejects.toEqual({ reason: 'CANCELLED' });
    expect(queue.cancelApiQueued('cancel-request')).toBe(1);
    await rejection;
    expect(callback).not.toHaveBeenCalled();
    expect(queue.getQueueState('cancel-request')).toEqual({ pending: 0, active: true });
    releases.get('active-request')!();
    await expect(active).resolves.toBe(1);
    expect(queue.getQueueState('cancel-request')).toEqual({ pending: 0, active: false });
  });

  it('preserves inferred synchronous and asynchronous callback results locally without transport', async () => {
    const queue = await loadTaskQueue();
    const events: string[] = [];
    const { dispatch } = await installScalarTransport(events, []);
    const synchronous = queue.runApiQueuedTask('values', () => 1);
    const value = { token: Symbol('local-only') };
    const asynchronous = queue.runApiQueuedTask('values', () => Promise.resolve(value));
    expectTypeOf(synchronous).toEqualTypeOf<Promise<number>>();
    expectTypeOf(asynchronous).toEqualTypeOf<Promise<typeof value>>();
    await expect(synchronous).resolves.toBe(1);
    await expect(asynchronous).resolves.toBe(value);
    await expect(queue.runApiQueuedTask<void>('values', () => {})).resolves.toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('rejects an empty job name synchronously before execution or queue admission', async () => {
    const queue = await loadTaskQueue();
    const callback = vi.fn(() => 'invalid');
    expect(() => queue.runApiQueuedTask('', callback)).toThrow();
    expect(callback).not.toHaveBeenCalled();
    expect(queue.getQueueState('valid')).toEqual({ pending: 0, active: false });
    await expect(queue.runApiQueuedTask('valid', callback)).resolves.toBe('invalid');
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
