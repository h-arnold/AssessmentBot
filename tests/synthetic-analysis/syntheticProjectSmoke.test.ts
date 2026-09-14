import { afterEach, describe, expect, it } from 'vitest';

import {
  createGoogleScriptRunApiHandlerMock,
  type GoogleScriptRunApiHandler,
} from '../../src/frontend/src/test/googleScriptRunHarness';
import { getABClass } from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService';
import { getAssignmentDefinitionPartials } from '../../src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService';
import { loadSyntheticAnalysisProfile } from '../../scripts/synthetic-test-data/loadSyntheticAnalysisProfile.js';

type GoogleScriptRunGlobal = {
  script: {
    run: GoogleScriptRunApiHandler;
  };
};

type GASGlobalsProbe = {
  RuntimeConstants?: unknown;
  Validate?: unknown;
  AssignmentDefinition?: unknown;
};

type BrowserGlobalsProbe = {
  window?: unknown;
  document?: unknown;
};

type ApiRequestProbe = {
  method?: unknown;
  params?: { classId?: unknown };
};

type ApiSuccessEnvelope = {
  ok: true;
  requestId: string;
  data: unknown;
};

const SMALL_PROFILE = 'small';
const GET_AB_CLASS_METHOD = 'getABClass';
const GET_ASSIGNMENT_DEFINITION_PARTIALS_METHOD = 'getAssignmentDefinitionPartials';

/**
 * Committed small-profile transport views. The smoke test uses the canonical
 * fixture rather than a hand-constructed response so it exercises the same data
 * the production services and analysis path consume.
 */
const committedClassesById = loadSyntheticAnalysisProfile(SMALL_PROFILE, 'classesById') as Record<
  string,
  unknown
>;
const committedDefinitionPartials = loadSyntheticAnalysisProfile(
  SMALL_PROFILE,
  'assignmentDefinitionPartials'
) as unknown[];

const committedClassId = Object.keys(committedClassesById)[0];
if (committedClassId === undefined) {
  throw new Error('Expected the committed small profile to contain at least one class');
}

const globalScope = globalThis as typeof globalThis & {
  google?: GoogleScriptRunGlobal;
};
const gasGlobals = globalThis as unknown as GASGlobalsProbe;
const browserGlobals = globalThis as unknown as BrowserGlobalsProbe;

const originalGoogle = (globalThis as { google?: unknown }).google;

afterEach(() => {
  const scope = globalThis as { google?: unknown };
  if (originalGoogle === undefined) {
    delete scope.google;
    return;
  }
  scope.google = originalGoogle;
});

/**
 * Selects the committed transport view for a captured request method.
 *
 * @param {unknown} request Captured `apiHandler` request payload.
 * @returns {unknown} The committed transport view to place in the success envelope.
 */
function selectTransportView(request: unknown): unknown {
  const probe = request as ApiRequestProbe | undefined;
  const method = probe?.method;

  if (method === GET_AB_CLASS_METHOD) {
    const requestedClassId = String(probe?.params?.classId);
    const classFull = committedClassesById[requestedClassId];
    if (classFull === undefined) {
      throw new Error(`Unexpected getABClass classId: ${requestedClassId}`);
    }
    return classFull;
  }
  if (method === GET_ASSIGNMENT_DEFINITION_PARTIALS_METHOD) {
    return committedDefinitionPartials;
  }

  throw new Error(`Unexpected API method: ${String(method)}`);
}

describe('synthetic analysis Node integration project', () => {
  it('loads the shared GAS globals installed by tests/setupGlobals.js', () => {
    expect(gasGlobals.RuntimeConstants).toBeDefined();
    expect(gasGlobals.Validate).toBeDefined();
    expect(gasGlobals.AssignmentDefinition).toBeDefined();
  });

  it('invokes both real frontend transport services through the installed harness', async () => {
    const capturedRequests: unknown[] = [];

    const runner = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
      capturedRequests.push(request);

      const envelope: ApiSuccessEnvelope = {
        ok: true,
        requestId: 'synthetic-request-1',
        data: selectTransportView(request),
      };
      callbacks.successHandler?.(envelope);
    });

    globalScope.google = { script: { run: runner } };

    const classResult = await getABClass({ classId: committedClassId });
    const definitionPartials = await getAssignmentDefinitionPartials();

    expect(classResult).not.toBeNull();
    expect(classResult?.classId).toBe(committedClassId);
    expect(definitionPartials).toEqual(committedDefinitionPartials);

    expect(capturedRequests).toHaveLength(2);
    expect(capturedRequests[0]).toMatchObject({
      method: GET_AB_CLASS_METHOD,
      params: { classId: committedClassId },
    });
    expect(capturedRequests[1]).toMatchObject({
      method: GET_ASSIGNMENT_DEFINITION_PARTIALS_METHOD,
    });

    expect(browserGlobals.window).toBeUndefined();
    expect(browserGlobals.document).toBeUndefined();
  });
});
