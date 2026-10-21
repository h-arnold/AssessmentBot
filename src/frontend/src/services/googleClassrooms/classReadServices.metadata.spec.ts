import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import smallClassesRaw from '@synthetic/small/classesById.json?raw';
import mediumClassesRaw from '@synthetic/medium/classesById.json?raw';
import representativeClassesRaw from '@synthetic/large-representative/classesById.json?raw';
import { ApiTransportError } from '@/errors/apiTransportError';
import {
  METADATA_PROFILES,
  METADATA_PROFILE_CLASS_PARTIALS,
} from '@/test/abClass/abClassMetadataFixtures';
import { deepFreeze } from '@/test/shared/canonicalFixturePrimitives';
import { callApi } from '../apiService';
import { getABClassPartials } from './classPartialsService';
import { getABClass } from './classDetail/classDetailService';

vi.mock(import('../apiService'), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, callApi: vi.fn() };
});

const classesByProfile = deepFreeze({
  small: JSON.parse(smallClassesRaw) as Record<string, Record<string, unknown>>,
  medium: JSON.parse(mediumClassesRaw) as Record<string, Record<string, unknown>>,
  'large-representative': JSON.parse(representativeClassesRaw) as Record<
    string,
    Record<string, unknown>
  >,
});

const callApiMock = vi.mocked(callApi);

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe.each(METADATA_PROFILES)('class read services with the %s profile', (profile) => {
  it('retains every canonical metadata variant identically through both real response parsers', async () => {
    const rows = structuredClone(METADATA_PROFILE_CLASS_PARTIALS[profile]);
    callApiMock.mockImplementationOnce(() => Promise.resolve(rows));

    const partials = await getABClassPartials();

    expect(callApiMock).toHaveBeenNthCalledWith(1, 'getABClassPartials');
    expect(partials).toHaveLength(rows.length);
    for (const [index, partial] of partials.entries()) {
      const fullWire = structuredClone(classesByProfile[profile][partial.classId]);
      callApiMock.mockImplementationOnce(() => Promise.resolve(fullWire));

      const full = await getABClass({ classId: partial.classId });

      expect(callApiMock).toHaveBeenLastCalledWith('getABClass', { classId: partial.classId });
      expect(full).not.toBeNull();
      expect(Object.hasOwn(partial, 'metadata')).toBe(true);
      expect(full).toHaveProperty('metadata', rows[index].metadata);
      expect(partial.metadata).toEqual(rows[index].metadata);
      expect(full?.metadata).toEqual(partial.metadata);
      if (partial.metadata === null) {
        continue;
      }
      expect(partial.metadata).not.toBe(rows[index].metadata);
      expect(full?.metadata).not.toBe(fullWire.metadata);
      expect(full?.metadata).not.toBe(partial.metadata);
    }
    expect(callApiMock).toHaveBeenCalledTimes(rows.length + 1);
  });
});

describe.each(['getABClass', 'getABClassPartials'] as const)(
  '%s metadata response contract',
  (method) => {
    /**
     * Supplies a local boundary probe to the selected real service wrapper.
     * @param {Record<string, unknown>} wire - Cloned canonical full-class wire record.
     * @returns {Promise<unknown>} Parsed service result.
     */
    function read(wire: Record<string, unknown>): Promise<unknown> {
      callApiMock.mockImplementationOnce(() =>
        Promise.resolve(method === 'getABClass' ? wire : [wire])
      );
      return method === 'getABClass'
        ? getABClass({ classId: String(wire.classId) })
        : getABClassPartials();
    }

    it.each([
      [
        'missing',
        (wire: Record<string, unknown>) => {
          delete wire.metadata;
        },
      ],
      [
        'own undefined',
        (wire: Record<string, unknown>) => {
          wire.metadata = undefined;
        },
      ],
      [
        'incomplete',
        (wire: Record<string, unknown>) => {
          wire.metadata = { recentAssignments: [] };
        },
      ],
      [
        'unexpected key',
        (wire: Record<string, unknown>) => {
          wire.metadata = { ...(wire.metadata as Record<string, unknown>), unexpected: true };
        },
      ],
    ] as const)(
      'rejects %s metadata through parseApiResponse with method diagnostics',
      async (_label, corrupt) => {
        const wire = structuredClone(classesByProfile.small['class-1']);
        corrupt(wire);
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(read(wire)).rejects.toBeInstanceOf(z.ZodError);

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
        expect(callApiMock).toHaveBeenCalledTimes(1);
      }
    );

    it('strips unrelated wire fields without losing the nullable metadata field', async () => {
      const wire = structuredClone(classesByProfile.small['class-0']);
      wire.storageOnly = 'strip-me';

      const result = await read(wire);
      const parsed = Array.isArray(result) ? result[0] : result;

      expect(parsed).not.toHaveProperty('storageOnly');
      expect(parsed).toHaveProperty('metadata', null);
    });

    it.each(['INVALID_REQUEST', 'INTERNAL_ERROR'])(
      'preserves %s transport error identity and correlation',
      async (code) => {
        const error = new ApiTransportError({
          requestId: 'class-read-request',
          error: { code, message: 'Class read failed', isRetriable: false },
          meta: { method },
        });
        callApiMock.mockImplementationOnce(() => Promise.reject(error));
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
        const result =
          method === 'getABClass' ? getABClass({ classId: 'class-1' }) : getABClassPartials();

        await expect(result).rejects.toBe(error);
        expect(error).toMatchObject({
          code,
          requestId: 'class-read-request',
          isRetriable: false,
          meta: { method },
        });
        expect(errorLog).not.toHaveBeenCalled();
        expect(callApiMock).toHaveBeenCalledTimes(1);
      }
    );
  }
);

describe('class read absence contracts', () => {
  it('keeps not-found full-class null distinct from existing-class metadata null and an empty partial list', async () => {
    callApiMock.mockImplementationOnce(() => Promise.resolve(null));
    await expect(getABClass({ classId: 'missing-class' })).resolves.toBeNull();

    callApiMock.mockImplementationOnce(() => Promise.resolve(classesByProfile.small['class-0']));
    await expect(getABClass({ classId: 'class-0' })).resolves.toHaveProperty('metadata', null);

    callApiMock.mockImplementationOnce(() => Promise.resolve([]));
    await expect(getABClassPartials()).resolves.toEqual([]);
  });
});
