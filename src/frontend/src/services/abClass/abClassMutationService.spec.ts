import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiTransportError } from '@/errors/apiTransportError';
import {
  createMutationResponse,
  createUpdateRequest,
  createUpsertRequest,
} from '@/test/abClass/abClassMutationFixtures';
import { callApi } from '../apiService';
import * as queue from '../api/apiQueue';
import { upsertABClass, updateABClass } from './abClassMutationService';
import type { UpdateABClassRequest } from './abClassMutations.zod';
import type { ClassPartial } from '../googleClassrooms/classPartials.zod';

vi.mock(import('../apiService'), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, callApi: vi.fn() };
});

const callApiMock = vi.mocked(callApi);
const JOB_NAME = 'classesBulkMutation';

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

registerMutationServiceTests('upsertABClass', upsertABClass, createUpsertRequest);
registerMutationServiceTests('updateABClass', updateABClass, createMinimalUpdateRequest);

/**
 * Creates an update request with every editable field omitted.
 * @returns {UpdateABClassRequest} Canonical class identifier only.
 */
function createMinimalUpdateRequest() {
  return { classId: createMutationResponse().classId };
}

/**
 * Registers the same boundary assertions with each service's correlated request type.
 * @param {string} method - Backend mutation method.
 * @param {Function} mutate - Typed production wrapper, invoked without test-side validation.
 * @param {Function} createRequest - Canonical request factory for this wrapper.
 */
function registerMutationServiceTests<Request extends UpdateABClassRequest>(
  method: string,
  mutate: (request: Request) => Promise<ClassPartial>,
  createRequest: () => Request
) {
  describe(`${method} validated queued service`, () => {
    it.each(['omitted', 'null', 'replacement'] as const)(
      'preserves %s metadata in the dispatched request and parses the partial response',
      async (presence) => {
        const response = createMutationResponse();
        const request = {
          ...createRequest(),
          ...(presence !== 'omitted' && {
            metadata: presence === 'null' ? null : createUpdateRequest().metadata,
          }),
        };
        callApiMock.mockImplementationOnce(() => Promise.resolve(response));

        const result = await mutate(request);

        expect(callApiMock).toHaveBeenCalledExactlyOnceWith(method, request);
        expect(Object.hasOwn(callApiMock.mock.calls[0][1] as object, 'metadata')).toBe(
          presence !== 'omitted'
        );
        expect(result).toEqual(response);
        expect(result.metadata).not.toBe(response.metadata);
      }
    );

    it('retains explicit null response metadata and strips unrelated response fields', async () => {
      const response = { ...createMutationResponse(), metadata: null, storageOnly: 'discard' };
      callApiMock.mockImplementationOnce(() => Promise.resolve(response));
      const result = await mutate(createRequest());
      expect(result).toHaveProperty('metadata', null);
      expect(result).not.toHaveProperty('storageOnly');
    });

    it.each(['missing', 'undefined', 'incomplete', 'null partial'] as const)(
      'rejects %s success payload through the real parseApiResponse diagnostics',
      async (probe) => {
        const response: Record<string, unknown> = createMutationResponse();
        switch (probe) {
          case 'missing': {
            delete response.metadata;
            break;
          }
          case 'undefined': {
            response.metadata = undefined;
            break;
          }
          case 'incomplete': {
            response.metadata = { recentAssignments: [] };
            break;
          }
        }
        callApiMock.mockImplementationOnce(() =>
          Promise.resolve(probe === 'null partial' ? null : response)
        );
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(mutate(createRequest())).rejects.toBeInstanceOf(z.ZodError);

        const diagnosticMetadata = expect.objectContaining({
          method,
          zodIssues: expect.any(Array),
          responsePreview: expect.any(String),
        });
        expect(errorLog).toHaveBeenCalledExactlyOnceWith(
          'services/apiService.parseApiResponse',
          expect.objectContaining({
            metadata: diagnosticMetadata,
          })
        );
      }
    );

    it.each(['INVALID_REQUEST', 'INTERNAL_ERROR'])(
      'preserves %s error identity, retryability and correlation without reclassification',
      async (code) => {
        const error = new ApiTransportError({
          requestId: 'mutation-request',
          error: { code, message: 'Mutation failed', isRetriable: false },
          meta: { method },
        });
        callApiMock.mockImplementationOnce(() => Promise.reject(error));
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(mutate(createRequest())).rejects.toBe(error);

        expect(error).toMatchObject({
          code,
          requestId: 'mutation-request',
          isRetriable: false,
          meta: { method },
        });
        expect(callApiMock).toHaveBeenCalledTimes(1);
        expect(errorLog).not.toHaveBeenCalled();
      }
    );

    it('shares the actual bulk FIFO and snapshots metadata before waiting for its slot', async () => {
      const gate = Promise.withResolvers<void>();
      const blocker = queue.runApiQueuedTask(JOB_NAME, () => gate.promise);
      const metadata = createUpdateRequest().metadata;
      const request = { ...createRequest(), metadata };
      const expected = structuredClone(request);
      callApiMock.mockImplementation(() => Promise.resolve(createMutationResponse()));
      try {
        const pending = mutate(request);
        expect(queue.getQueueState(JOB_NAME)).toEqual({ active: true, pending: 1 });
        expect(callApiMock).not.toHaveBeenCalled();
        metadata.classAverages.overall = 0;
        metadata.recentAssignments.length = 0;
        gate.resolve();
        await blocker;
        await pending;
        expect(callApiMock).toHaveBeenCalledExactlyOnceWith(method, expected);
        expect(callApiMock.mock.calls[0][1]).not.toBe(request);
      } finally {
        gate.resolve();
        await blocker;
      }
    });

    it('rejects invalid mixed metadata before admission to an occupied queue', async () => {
      const gate = Promise.withResolvers<void>();
      const blocker = queue.runApiQueuedTask(JOB_NAME, () => gate.promise);
      const enqueue = vi.spyOn(queue, 'callApiQueued');
      const reserve = vi.spyOn(queue, 'runApiQueuedTask');
      try {
        await expect(
          mutate({ ...createRequest(), cohortKey: 'valid', metadata: undefined })
        ).rejects.toBeInstanceOf(z.ZodError);
        expect(queue.getQueueState(JOB_NAME)).toEqual({ active: true, pending: 0 });
        expect(enqueue).not.toHaveBeenCalled();
        expect(reserve).not.toHaveBeenCalled();
        expect(callApiMock).not.toHaveBeenCalled();
      } finally {
        gate.resolve();
        await blocker;
      }
    });
  });
}

describe('upsertABClass admission atomicity', () => {
  it.each(['cohortKey', 'yearGroupKey'] as const)(
    'rejects null upsert configuration %s before enqueue or network',
    async (field) => {
      const gate = Promise.withResolvers<void>();
      const blocker = queue.runApiQueuedTask(JOB_NAME, () => gate.promise);
      const enqueue = vi.spyOn(queue, 'callApiQueued');
      const reserve = vi.spyOn(queue, 'runApiQueuedTask');
      callApiMock.mockImplementation(() => Promise.resolve(createMutationResponse()));
      const pending = upsertABClass({ ...createUpsertRequest(), [field]: null });
      const settled = Promise.allSettled([pending]);
      try {
        expect(enqueue).not.toHaveBeenCalled();
        expect(reserve).not.toHaveBeenCalled();
        expect(callApiMock).not.toHaveBeenCalled();
        expect(queue.getQueueState(JOB_NAME)).toEqual({ active: true, pending: 0 });
        await expect(pending).rejects.toBeInstanceOf(z.ZodError);
      } finally {
        gate.resolve();
        await blocker;
        await settled;
      }
    }
  );
});

describe('updateABClass admission atomicity', () => {
  it.each(['cohortKey', 'yearGroupKey', 'courseLength', 'active', 'metadata'])(
    'rejects own undefined %s before enqueue or network',
    async (field) => {
      const enqueue = vi.spyOn(queue, 'callApiQueued');
      const reserve = vi.spyOn(queue, 'runApiQueuedTask');
      await expect(
        updateABClass({ ...createUpdateRequest(), active: true, [field]: undefined })
      ).rejects.toBeInstanceOf(z.ZodError);
      expect(enqueue).not.toHaveBeenCalled();
      expect(reserve).not.toHaveBeenCalled();
      expect(callApiMock).not.toHaveBeenCalled();
      expect(queue.getQueueState(JOB_NAME)).toEqual({ active: false, pending: 0 });
    }
  );
});
