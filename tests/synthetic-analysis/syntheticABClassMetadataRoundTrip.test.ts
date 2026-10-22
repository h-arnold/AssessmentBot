import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type GoogleScriptRunApiHandler } from '@/test/googleScriptRunHarness';
import { createSyntheticApiRoundTripRunner } from '@/test/syntheticApiRoundTripAdapter';
import { createApiHandlerRoundTripBridge } from '#synthetic-data/apiHandlerRoundTripBridge.js';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';
import { getABClass } from '@/services/googleClassrooms/classDetail/classDetailService';
import { getABClassPartials } from '@/services/googleClassrooms/classPartialsService';
import { updateABClass } from '@/services/abClass/abClassMutationService';
import { upsertABClass } from '@/services/abClass/abClassMutationService';
import { ABClassMetadataSchema } from '@/services/abClass/abClassMetadata.zod';
import { ClassPartialSchema } from '@/services/googleClassrooms/classPartials.zod';
import { loadApiHandlerModule } from '../helpers/apiHandlerTestUtils.js';

type GoogleScriptGlobal = { google?: { script?: { run?: GoogleScriptRunApiHandler } } };
const PROFILE = 'small';
const canonicalPartials = loadSyntheticAnalysisProfile(PROFILE, 'classPartials') as Array<
  Record<string, unknown>
>;
const canonicalClasses = loadSyntheticAnalysisProfile(PROFILE, 'classesById') as Record<
  string,
  Record<string, unknown>
>;
const sourcePartial = canonicalPartials.find((row) => row.metadata !== null)!;
const classId = String(sourcePartial.classId);
const replacement = ABClassMetadataSchema.parse(sourcePartial.metadata);

function installRunner(bridge: ReturnType<typeof createApiHandlerRoundTripBridge>): void {
  vi.stubGlobal('google', {
    script: { run: createSyntheticApiRoundTripRunner(bridge.invokeRequest) },
  } satisfies GoogleScriptGlobal['google']);
}

describe('ABClass metadata real dispatcher round trip', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retains canonical metadata through full and partial reads and shared response schemas', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: PROFILE });
    installRunner(bridge);

    const full = await getABClass({ classId });
    const partials = await getABClassPartials();
    const partial = partials.find((row) => row.classId === classId);

    expect(full?.metadata).toEqual(sourcePartial.metadata);
    expect(partial?.metadata).toEqual(sourcePartial.metadata);
    expect(ClassPartialSchema.parse(partial).metadata).toEqual(sourcePartial.metadata);
    expect(canonicalClasses[classId].metadata).toEqual(sourcePartial.metadata);
  });

  it('retains, clears, and replaces metadata through queued update and upsert requests', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: PROFILE });
    installRunner(bridge);

    const upsertBase = {
      classId,
      cohortKey: 'cohort-0',
      yearGroupKey: 'year-group-7',
      courseLength: sourcePartial.courseLength as number,
    };
    const original = structuredClone(sourcePartial.metadata);
    for (const mutate of [
      () => updateABClass({ classId, active: true }),
      () => upsertABClass(upsertBase),
    ]) {
      await mutate();
      expect((await getABClass({ classId }))?.metadata).toEqual(original);
      expect((await getABClassPartials()).find((row) => row.classId === classId)?.metadata).toEqual(
        original
      );
    }
    for (const mutate of [
      (metadata: typeof replacement | null) => updateABClass({ classId, metadata }),
      (metadata: typeof replacement | null) => upsertABClass({ ...upsertBase, metadata }),
    ]) {
      await mutate(null);
      expect((await getABClass({ classId }))?.metadata).toBeNull();
      expect(
        (await getABClassPartials()).find((row) => row.classId === classId)?.metadata
      ).toBeNull();
      await mutate(replacement);
      expect((await getABClass({ classId }))?.metadata).toEqual(replacement);
      expect((await getABClassPartials()).find((row) => row.classId === classId)?.metadata).toEqual(
        replacement
      );
    }
    expect(sourcePartial.metadata).toEqual(original);
    expect(canonicalClasses[classId].metadata).toEqual(original);
  });

  it('rejects own undefined metadata before the real dispatcher is invoked', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: PROFILE });
    const invoke = vi.fn(bridge.invokeRequest);
    installRunner({ ...bridge, invokeRequest: invoke });

    await expect(updateABClass({ classId, metadata: undefined })).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('receives INVALID_REQUEST for malformed dispatch input and INTERNAL_ERROR for a throwing class seam', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: PROFILE });
    const dispatch = (request: unknown): unknown => {
      let response: unknown;
      bridge.invokeRequest(request, {
        successHandler: (value) => {
          response = value;
        },
      });
      return response;
    };
    const invalid = dispatch({ method: 42 }) as {
      ok: boolean;
      error: { code: string };
    };
    expect(invalid.ok).toBe(false);
    expect(invalid.error.code).toBe('INVALID_REQUEST');
    const internal = dispatch({
      method: 'updateABClass',
      params: { classId: 'missing-canonical-class', metadata: null },
    }) as {
      ok: boolean;
      error: { code: string };
    };
    expect(internal.ok).toBe(false);
    expect(internal.error.code).toBe('INTERNAL_ERROR');
  });

  it('isolates bridge state and restores dispatcher seams after successful and failed mutations', async () => {
    const firstBridge = createApiHandlerRoundTripBridge({ vi, profileName: PROFILE });
    const secondBridge = createApiHandlerRoundTripBridge({ vi, profileName: PROFILE });
    const dispatch = (bridge: typeof firstBridge, request: unknown): unknown => {
      let response: unknown;
      bridge.invokeRequest(request, { successHandler: (value) => (response = value) });
      return response;
    };
    const seams = [
      'ScriptAppManager',
      'ABClassController',
      'ReferenceDataController',
      'getGoogleClassrooms_',
      'getGoogleClassroomAssignments_',
      'upsertABClass_',
      'updateABClass_',
      'deleteABClass_',
      'getABClass_',
      'getAssignmentDefinitionPartials_',
      'getAssignmentDefinition_',
      'deleteAssignmentDefinition_',
    ] as const;
    loadApiHandlerModule();
    const before = Object.fromEntries(
      seams.map((key) => [key, (globalThis as Record<string, unknown>)[key]])
    );
    const ownedSpy = vi.spyOn(console, 'debug');

    dispatch(firstBridge, { method: 'updateABClass', params: { classId, metadata: null } });
    expect(seams.map((key) => (globalThis as Record<string, unknown>)[key])).toEqual(
      seams.map((key) => before[key])
    );
    const failure = dispatch(firstBridge, {
      method: 'updateABClass',
      params: { classId: 'missing-canonical-class', metadata: null },
    }) as { ok: boolean; error: { code: string } };
    expect(failure.error.code).toBe('INTERNAL_ERROR');
    expect(seams.map((key) => (globalThis as Record<string, unknown>)[key])).toEqual(
      seams.map((key) => before[key])
    );
    expect(
      (
        dispatch(secondBridge, { method: 'getABClass', params: { classId } }) as {
          data: { metadata: unknown };
        }
      ).data.metadata
    ).toEqual(replacement);
    expect(sourcePartial.metadata).toEqual(replacement);
    expect(console.debug).toBe(ownedSpy);
  });
});
