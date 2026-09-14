import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { getApiDispatcherInstance } from '../helpers/apiHandlerTestUtils.js';
import { type GoogleScriptRunApiHandler } from '../../src/frontend/src/test/googleScriptRunHarness';
import { createSyntheticApiRoundTripRunner } from '../../src/frontend/src/test/syntheticApiRoundTripAdapter';
import { createApiHandlerRoundTripBridge } from '../../scripts/synthetic-test-data/apiHandlerRoundTripBridge.js';
import { loadSyntheticAnalysisProfile } from '../../scripts/synthetic-test-data/loadSyntheticAnalysisProfile.js';
import { ApiTransportError } from '../../src/frontend/src/errors/apiTransportError';
import { callApi } from '../../src/frontend/src/services/apiService';
import { getABClass } from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService';
import {
  deleteAssignmentDefinition,
  getAssignmentDefinitionPartials,
} from '../../src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService';
import { DataAnalysisService } from '../../src/frontend/src/services/dataAnalysis/dataAnalysisService';

type GoogleScriptGlobal = {
  google?: { script?: { run?: GoogleScriptRunApiHandler } };
};

type EnvelopeProbe = {
  ok?: unknown;
  data?: unknown;
  requestId?: unknown;
};

const SMALL_PROFILE = 'small';
const GET_AB_CLASS_METHOD = 'getABClass';
const UNKNOWN_SYNTHETIC_METHOD = 'syntheticUnknownMethod';
const MISSING_CLASS_ID = 'synthetic-not-found-class';
const RAW_TRANSPORT_FAILURE = 'Synthetic raw transport failure';

const smallClassesById = loadSyntheticAnalysisProfile(SMALL_PROFILE, 'classesById') as Record<
  string,
  unknown
>;
const smallDefinitionPartials = loadSyntheticAnalysisProfile(
  SMALL_PROFILE,
  'assignmentDefinitionPartials'
) as Array<{ definitionKey: string }>;
const knownClassIds = Object.keys(smallClassesById);
const knownClassId = knownClassIds[0];
const knownDefinitionKey = smallDefinitionPartials[0].definitionKey;

/**
 * Every dispatcher global installed and restored by the shared
 * `apiHandlerTestUtils` seams that the bridge composes.
 */
const DISPATCHER_SEAM_GLOBAL_KEYS = [
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

/**
 * Installs a `google.script.run` runner for the current test.
 *
 * @param {GoogleScriptRunApiHandler} runner - The runner to install.
 */
function installGoogleRunner(runner: GoogleScriptRunApiHandler): void {
  (globalThis as GoogleScriptGlobal).google = { script: { run: runner } };
}

/**
 * Removes the mock `google.script.run` runner installed by a test.
 */
function clearGoogleRunner(): void {
  delete (globalThis as GoogleScriptGlobal).google;
}

/**
 * Captures the current value of every dispatcher seam the bridge installs.
 *
 * @remarks
 * The dispatcher module is loaded before sampling so any real handler it assigns
 * lazily to shared globals is part of the recorded pre-call state. Sampling before
 * that load would leave those seams undefined, which is the case where a leaked real
 * handler could otherwise masquerade as a restored seam.
 *
 * @returns {Record<string, unknown>} A snapshot keyed by dispatcher global name.
 */
function snapshotDispatcherSeams(): Record<string, unknown> {
  getApiDispatcherInstance();

  return Object.fromEntries(
    DISPATCHER_SEAM_GLOBAL_KEYS.map((key) => [key, (globalThis as Record<string, unknown>)[key]])
  );
}

/**
 * Asserts that a round trip restored every dispatcher seam exactly.
 *
 * @remarks
 * The snapshot is taken with the real dispatcher already loaded, so every seam is
 * either a real handler or deliberately absent before dispatch. Exact identity is
 * therefore required for all seams, including absent ones; accepting any non-mock
 * function would let a leaked real handler pass as a restored seam.
 *
 * @param {Record<string, unknown>} snapshot - The pre-dispatch seam snapshot.
 */
function expectDispatcherSeamsRestored(snapshot: Record<string, unknown>): void {
  for (const key of DISPATCHER_SEAM_GLOBAL_KEYS) {
    expect(
      (globalThis as Record<string, unknown>)[key],
      `dispatcher seam ${key} must be restored`
    ).toBe(snapshot[key]);
  }
}

describe('synthetic analysis dispatcher round-trip bridge', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    clearGoogleRunner();
    vi.restoreAllMocks();
  });

  it('routes generated getABClass and getAssignmentDefinitionPartials views through callApi and their Zod schemas', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: SMALL_PROFILE });
    installGoogleRunner(createSyntheticApiRoundTripRunner(bridge.invokeRequest));

    const classFull = await getABClass({ classId: knownClassId });
    expect(classFull).not.toBeNull();
    if (classFull === null) {
      throw new Error('Expected the generated getABClass view to resolve to a non-null ClassFull.');
    }
    expect(classFull.classId).toBe(knownClassId);
    expect(classFull.students.length).toBeGreaterThan(0);
    expect(classFull.assignments.length).toBeGreaterThan(0);

    const definitionPartials = await getAssignmentDefinitionPartials();
    expect(definitionPartials).toEqual(smallDefinitionPartials);
  });

  it('supplies the validated service results as DataAnalysisService input', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: SMALL_PROFILE });
    installGoogleRunner(createSyntheticApiRoundTripRunner(bridge.invokeRequest));

    const classFull = await getABClass({ classId: knownClassId });
    expect(classFull).not.toBeNull();
    if (classFull === null) {
      throw new Error('Expected a non-null ClassFull before analysis.');
    }
    const definitionPartials = await getAssignmentDefinitionPartials();

    const results = new DataAnalysisService().analyse({
      filter: { classIds: [classFull.classId] },
      classes: [classFull],
      assignmentDefinitionPartials: definitionPartials,
    });

    expect(results).toHaveLength(1);
    expect(results[0].classId).toBe(knownClassId);
  });

  it('serialises the success envelope exactly once through the factory-compatible adapter runner', () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: SMALL_PROFILE });
    const runner = createSyntheticApiRoundTripRunner(bridge.invokeRequest);
    const deliveredSuccess: unknown[] = [];
    const deliveredFailure: unknown[] = [];

    runner
      .withSuccessHandler((response) => {
        deliveredSuccess.push(response);
      })
      .withFailureHandler((error) => {
        deliveredFailure.push(error);
      })
      .apiHandler({ method: GET_AB_CLASS_METHOD, params: { classId: knownClassId } });

    expect(deliveredFailure).toHaveLength(0);
    expect(deliveredSuccess).toHaveLength(1);

    const serialisedEnvelope = deliveredSuccess[0];
    expect(typeof serialisedEnvelope).toBe('string');

    const parsedEnvelope = JSON.parse(serialisedEnvelope as string) as EnvelopeProbe;
    expect(parsedEnvelope.ok).toBe(true);
    expect(typeof parsedEnvelope.requestId).toBe('string');
    expect(typeof parsedEnvelope.data).toBe('object');
  });

  it('surfaces a malformed-but-enveloped payload through the consumer Zod schema', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: SMALL_PROFILE });
    installGoogleRunner(
      createSyntheticApiRoundTripRunner((request, callbacks) => {
        bridge.invokeRequest(request, {
          successHandler: (value) => {
            callbacks.successHandler?.({
              ...(value as EnvelopeProbe),
              data: { classId: 'synthetic-invalid-class' },
            });
          },
          failureHandler: callbacks.failureHandler,
        });
      })
    );

    await expect(getABClass({ classId: knownClassId })).rejects.toBeInstanceOf(ZodError);
  });

  it('maps a backend failure envelope to ApiTransportError', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: SMALL_PROFILE });
    installGoogleRunner(createSyntheticApiRoundTripRunner(bridge.invokeRequest));

    const failure = await callApi(UNKNOWN_SYNTHETIC_METHOD).then(
      () => {
        throw new Error('Expected callApi to reject for an unknown dispatcher method.');
      },
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(ApiTransportError);
    expect((failure as ApiTransportError).code).toBe('UNKNOWN_METHOD');
  });

  it('keeps raw transport failures raw', async () => {
    installGoogleRunner(
      createSyntheticApiRoundTripRunner((_request, callbacks) => {
        callbacks.failureHandler?.(RAW_TRANSPORT_FAILURE);
      })
    );

    await expect(callApi(GET_AB_CLASS_METHOD, { classId: knownClassId })).rejects.toBe(
      RAW_TRANSPORT_FAILURE
    );
  });

  it('resolves a void response from data: null', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: SMALL_PROFILE });
    installGoogleRunner(createSyntheticApiRoundTripRunner(bridge.invokeRequest));

    await expect(
      deleteAssignmentDefinition({ definitionKey: knownDefinitionKey })
    ).resolves.toBeNull();
  });

  it('keeps overlapping calls bound to their own callbacks when completions arrive out of order', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: SMALL_PROFILE });
    const pendingBridgeInvocations: Array<() => void> = [];

    // Defer every bridge completion until all requests have registered, then release
    // them in reverse order so the first-registered request completes last.
    installGoogleRunner(
      createSyntheticApiRoundTripRunner((request, callbacks) => {
        pendingBridgeInvocations.push(() => {
          bridge.invokeRequest(request, callbacks);
        });
      })
    );

    const firstClassId = knownClassIds[0];
    const lastClassId = knownClassIds[knownClassIds.length - 1];

    const firstClassPromise = getABClass({ classId: firstClassId });
    const lastClassPromise = getABClass({ classId: lastClassId });
    const definitionPartialsPromise = getAssignmentDefinitionPartials();

    expect(pendingBridgeInvocations).toHaveLength(3);

    pendingBridgeInvocations[2]();
    pendingBridgeInvocations[1]();
    pendingBridgeInvocations[0]();

    const [firstClass, lastClass, definitionPartials] = await Promise.all([
      firstClassPromise,
      lastClassPromise,
      definitionPartialsPromise,
    ]);

    expect(firstClass?.classId).toBe(firstClassId);
    expect(lastClass?.classId).toBe(lastClassId);
    expect(firstClass?.classId).not.toBe(lastClass?.classId);
    expect(definitionPartials).toEqual(smallDefinitionPartials);
  });

  it('distinguishes a null getABClass result as a not-found branch that is never analysed', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: SMALL_PROFILE });
    installGoogleRunner(createSyntheticApiRoundTripRunner(bridge.invokeRequest));

    const missingClass = await getABClass({ classId: MISSING_CLASS_ID });
    expect(missingClass).toBeNull();

    const analysableClasses = [missingClass].filter((classFull) => classFull !== null);
    expect(analysableClasses).toHaveLength(0);
  });

  it('restores every dispatcher seam after a successful round trip and keeps the original state for the next call', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: SMALL_PROFILE });
    const snapshot = snapshotDispatcherSeams();
    installGoogleRunner(createSyntheticApiRoundTripRunner(bridge.invokeRequest));

    const firstClass = await getABClass({ classId: knownClassId });
    expect(firstClass?.classId).toBe(knownClassId);
    expectDispatcherSeamsRestored(snapshot);

    const lastClassId = knownClassIds[knownClassIds.length - 1];
    const secondClass = await getABClass({ classId: lastClassId });
    expect(secondClass?.classId).toBe(lastClassId);
    expectDispatcherSeamsRestored(snapshot);
  });

  it('restores every dispatcher seam, including the delete handler, after a void round trip', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: SMALL_PROFILE });
    const snapshot = snapshotDispatcherSeams();
    installGoogleRunner(createSyntheticApiRoundTripRunner(bridge.invokeRequest));

    await expect(
      deleteAssignmentDefinition({ definitionKey: knownDefinitionKey })
    ).resolves.toBeNull();

    expectDispatcherSeamsRestored(snapshot);
  });

  it('restores every dispatcher seam after a backend failure envelope', async () => {
    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: SMALL_PROFILE });
    const snapshot = snapshotDispatcherSeams();
    installGoogleRunner(createSyntheticApiRoundTripRunner(bridge.invokeRequest));

    await expect(callApi(UNKNOWN_SYNTHETIC_METHOD)).rejects.toBeInstanceOf(ApiTransportError);

    expectDispatcherSeamsRestored(snapshot);
  });
});
