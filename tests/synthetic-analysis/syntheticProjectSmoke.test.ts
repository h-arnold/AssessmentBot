import { afterEach, describe, expect, it } from 'vitest';

import {
  createGoogleScriptRunApiHandlerMock,
  type GoogleScriptRunApiHandler,
} from '../../src/frontend/src/test/googleScriptRunHarness';
import { getABClass } from '../../src/frontend/src/services/googleClassrooms/classDetail/classDetailService';
import { getAssignmentDefinitionPartials } from '../../src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService';

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
  params?: unknown;
};

type ApiSuccessEnvelope = {
  ok: true;
  requestId: string;
  data: unknown;
};

const GET_AB_CLASS_METHOD = 'getABClass';
const GET_ASSIGNMENT_DEFINITION_PARTIALS_METHOD = 'getAssignmentDefinitionPartials';
const SYNTHETIC_CLASS_ID = 'synthetic-class-1';

/**
 * Minimal schema-valid `ClassFull` transport view for the `getABClass` service.
 */
const SYNTHETIC_CLASS_FULL = {
  classId: SYNTHETIC_CLASS_ID,
  className: null,
  cohortKey: null,
  courseLength: 1,
  yearGroupKey: null,
  classOwner: null,
  teachers: [],
  students: [],
  assignments: [],
  active: null,
} as const;

/**
 * Minimal schema-valid `AssignmentDefinitionPartials` transport view.
 */
const SYNTHETIC_DEFINITION_PARTIALS = [
  {
    primaryTitle: 'Synthetic primary title',
    primaryTopic: 'Synthetic primary topic',
    primaryTopicKey: 'synthetic-topic',
    yearGroupKey: 'year-7',
    yearGroupLabel: 'Year 7',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: null,
    templateDocumentId: null,
    assignmentWeighting: null,
    definitionKey: 'synthetic-definition',
    tasks: [],
    createdAt: null,
    updatedAt: null,
  },
] as const;

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
 * Selects the minimal valid transport payload for a captured request method.
 *
 * @param {unknown} request Captured `apiHandler` request payload.
 * @returns {unknown} The transport view to place in the success envelope.
 */
function selectTransportView(request: unknown): unknown {
  const method = (request as ApiRequestProbe | undefined)?.method;

  if (method === GET_AB_CLASS_METHOD) {
    return SYNTHETIC_CLASS_FULL;
  }
  if (method === GET_ASSIGNMENT_DEFINITION_PARTIALS_METHOD) {
    return SYNTHETIC_DEFINITION_PARTIALS;
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

    const classResult = await getABClass({ classId: SYNTHETIC_CLASS_ID });
    const definitionPartials = await getAssignmentDefinitionPartials();

    expect(classResult).not.toBeNull();
    expect(classResult?.classId).toBe(SYNTHETIC_CLASS_ID);
    expect(definitionPartials).toEqual(SYNTHETIC_DEFINITION_PARTIALS);

    expect(capturedRequests).toHaveLength(2);
    expect(capturedRequests[0]).toMatchObject({
      method: GET_AB_CLASS_METHOD,
      params: { classId: SYNTHETIC_CLASS_ID },
    });
    expect(capturedRequests[1]).toMatchObject({
      method: GET_ASSIGNMENT_DEFINITION_PARTIALS_METHOD,
    });

    expect(browserGlobals.window).toBeUndefined();
    expect(browserGlobals.document).toBeUndefined();
  });
});
