import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalisedMetadataExpectation } from '@synthetic/normalisedMetadataExpectation';

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
const FIVE_FIELD_KEYS = [
  'classAverages',
  'recentAssignments',
  'baselineAverages',
  'allTaskStandings',
  'baselineStandings',
] as const;
const sourcePartial = canonicalPartials.find((row) => row.metadata !== null)!;
const classId = String(sourcePartial.classId);
const rawMetadata = sourcePartial.metadata as Record<string, unknown>;
// The replacement is derived from the fixture's own five fields; after regeneration it carries
// real supplied standings and baseline rather than null placeholders.
const replacement = ABClassMetadataSchema.parse(rawMetadata);
// Read projections emit all five fields. Derive the expectation from the raw bytes, not from the
// schema under test: any new field absent from the raw fixture normalises to an enumerable null.
const normalisedSourceMetadata = normalisedMetadataExpectation(rawMetadata);
// Raw dispatch bytes omit null-valued properties; derive them from the raw fixture so the
// expectation follows regeneration instead of pinning the current two-field literal.
const rawReplacement = Object.fromEntries(
  Object.entries(rawMetadata).filter(([, value]) => value !== null)
);

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

    expect(full?.metadata).toEqual(normalisedSourceMetadata);
    expect(partial?.metadata).toEqual(normalisedSourceMetadata);
    expect(ClassPartialSchema.parse(partial).metadata).toEqual(normalisedSourceMetadata);
    expect(canonicalClasses[classId].metadata).toEqual(sourcePartial.metadata);
  });

  it('commits a five-field source snapshot in the regenerated fixture', () => {
    expect(Object.keys(rawMetadata).sort()).toEqual([...FIVE_FIELD_KEYS].sort());
    expect(normalisedSourceMetadata).toEqual(rawMetadata);
    expect(replacement).toEqual(rawMetadata);
  });

  it('round trips a five-field replacement with supplied standings through update and upsert', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: PROFILE });
    installRunner(bridge);
    const base = {
      classAverages: rawMetadata.classAverages,
      recentAssignments: rawMetadata.recentAssignments,
    };
    const supplied = ABClassMetadataSchema.parse(suppliedFiveField(base));
    for (const mutate of [
      (metadata: typeof supplied) => updateABClass({ classId, metadata }),
      (metadata: typeof supplied) =>
        upsertABClass({
          classId,
          cohortKey: 'cohort-0',
          yearGroupKey: 'year-group-7',
          courseLength: sourcePartial.courseLength as number,
          metadata,
        }),
    ]) {
      await mutate(supplied);
      expect((await getABClass({ classId }))?.metadata).toEqual(supplied);
      expect((await getABClassPartials()).find((row) => row.classId === classId)?.metadata).toEqual(
        supplied
      );
    }
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
      expect((await getABClass({ classId }))?.metadata).toEqual(normalisedSourceMetadata);
      expect((await getABClassPartials()).find((row) => row.classId === classId)?.metadata).toEqual(
        normalisedSourceMetadata
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
      // The global `apiHandler` hands its envelope over as a JSON string.
      expect(typeof response).toBe('string');
      return JSON.parse(response as string);
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
      // The global `apiHandler` hands its envelope over as a JSON string.
      expect(typeof response).toBe('string');
      return JSON.parse(response as string);
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
    ).toEqual(rawReplacement);
    expect(sourcePartial.metadata).toEqual(rawReplacement);
    expect(console.debug).toBe(ownedSpy);
  });
});

/**
 * Builds a five-field snapshot from a two-field fixture base using deterministic supplied
 * standings derived only from that base's own scores and recent entries.
 * @param base - Legacy class averages and recent assignments from the raw fixture.
 * @returns A controlled five-field raw snapshot.
 */
function suppliedFiveField(base: Record<string, unknown>): Record<string, unknown> {
  const scores = { ...(base.classAverages as Record<string, unknown>) };
  delete scores.updatedAt;
  const recent = base.recentAssignments as Array<{ averages: Record<string, unknown> }>;
  const standing = {
    studentId: 'student-0',
    studentName: 'Student 0',
    scores: { ...scores },
    recentAssignmentScores: recent.map((assignment) => ({ ...assignment.averages })),
  };
  return {
    ...base,
    baselineAverages: {
      ...scores,
      updatedAt: (base.classAverages as Record<string, unknown>).updatedAt,
    },
    allTaskStandings: { top: [standing], bottom: [] },
    baselineStandings: { top: [], bottom: [] },
  };
}
