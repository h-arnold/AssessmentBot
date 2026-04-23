import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const UPSERT_TRANSPORT_MODULE_PATH_CANDIDATES = Object.freeze([
  '../../src/backend/z_Api/assignmentDefinitionPartials.js',
  '../../src/backend/z_Api/assignmentDefinitionMutations.js',
]);
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

function clearUpsertTransportModuleCaches() {
  UPSERT_TRANSPORT_MODULE_PATH_CANDIDATES.forEach((modulePath) => {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch (error) {
      if (error?.code !== 'MODULE_NOT_FOUND') {
        throw error;
      }
    }
  });
}

function loadAssignmentDefinitionUpsertTransportModule() {
  const exportContractFailures = [];

  for (const modulePath of UPSERT_TRANSPORT_MODULE_PATH_CANDIDATES) {
    let moduleExports;

    try {
      moduleExports = require(modulePath);
    } catch (error) {
      if (error?.code === 'MODULE_NOT_FOUND') {
        continue;
      }

      throw error;
    }

    if (typeof moduleExports.upsertAssignmentDefinition_ === 'function') {
      return moduleExports;
    }

    exportContractFailures.push(modulePath);
  }

  const candidateLocations = UPSERT_TRANSPORT_MODULE_PATH_CANDIDATES.join(', ');
  const exportFailureDetails =
    exportContractFailures.length > 0
      ? ' Missing upsertAssignmentDefinition_ export in: ' + exportContractFailures.join(', ') + '.'
      : '';

  throw new Error(
    'Missing upsert transport helper surface. Expected upsertAssignmentDefinition_ export from one of: ' +
      candidateLocations +
      '.' +
      exportFailureDetails
  );
}

function buildValidUpsertPayload(overrides = {}) {
  return {
    primaryTitle: 'Algebra Baseline',
    primaryTopicKey: 'topic-algebra',
    yearGroup: 10,
    alternateTitles: ['Algebra Starter'],
    referenceDocumentId: 'ref-doc-001',
    templateDocumentId: 'tpl-doc-001',
    assignmentWeighting: null,
    taskWeightings: [{ taskId: 'task-1', taskWeighting: 25 }],
    ...overrides,
  };
}

function buildFullDefinition(overrides = {}) {
  return {
    primaryTitle: 'Algebra Baseline',
    primaryTopicKey: 'topic-algebra',
    primaryTopic: 'Algebra',
    yearGroup: 10,
    alternateTitles: ['Algebra Starter'],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-doc-001',
    templateDocumentId: 'tpl-doc-001',
    referenceLastModified: '2026-01-05T10:00:00.000Z',
    templateLastModified: '2026-01-05T10:00:00.000Z',
    assignmentWeighting: null,
    definitionKey: 'definition-001',
    tasks: {
      'task-1': {
        id: 'task-1',
        taskTitle: 'Task 1',
        pageId: null,
        taskNotes: null,
        taskMetadata: {},
        taskWeighting: 25,
        index: 0,
        artifacts: {
          reference: [],
          template: [],
        },
      },
    },
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-06T12:30:00.000Z',
    ...overrides,
  };
}

function installAssignmentDefinitionControllerStub() {
  const upsertDefinition = vi.fn();
  const AssignmentDefinitionController = vi.fn(function StubAssignmentDefinitionController() {
    this.upsertDefinition = upsertDefinition;
  });

  globalThis.AssignmentDefinitionController = AssignmentDefinitionController;

  return { AssignmentDefinitionController, upsertDefinition };
}

describe('Api/upsertAssignmentDefinition transport contract', () => {
  let originalAssignmentDefinitionController;

  beforeEach(() => {
    originalAssignmentDefinitionController = globalThis.AssignmentDefinitionController;
  });

  afterEach(() => {
    clearUpsertTransportModuleCaches();

    if (originalAssignmentDefinitionController === undefined) {
      delete globalThis.AssignmentDefinitionController;
    } else {
      globalThis.AssignmentDefinitionController = originalAssignmentDefinitionController;
    }

    vi.restoreAllMocks();
  });

  it('requires an upsert helper export from one assignment-definition transport module location', () => {
    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionUpsertTransportModule();

    expect(upsertAssignmentDefinition_).toEqual(expect.any(Function));
  });

  it('delegates valid create payloads to the controller and returns full definition data', () => {
    const { AssignmentDefinitionController, upsertDefinition } =
      installAssignmentDefinitionControllerStub();
    const payload = buildValidUpsertPayload();
    const expectedDefinition = buildFullDefinition();
    upsertDefinition.mockReturnValue(expectedDefinition);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionUpsertTransportModule();
    const response = upsertAssignmentDefinition_(payload);

    expect(response).toEqual(expectedDefinition);
    expect(AssignmentDefinitionController).toHaveBeenCalledTimes(1);
    expect(upsertDefinition).toHaveBeenCalledTimes(1);
    expect(upsertDefinition).toHaveBeenCalledWith(payload);
  });

  it('delegates valid update payloads with the supplied definitionKey', () => {
    const { upsertDefinition } = installAssignmentDefinitionControllerStub();
    const payload = buildValidUpsertPayload({ definitionKey: 'definition-001' });
    const expectedDefinition = buildFullDefinition({ definitionKey: 'definition-001' });
    upsertDefinition.mockReturnValue(expectedDefinition);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionUpsertTransportModule();
    const response = upsertAssignmentDefinition_(payload);

    expect(response).toEqual(expectedDefinition);
    expect(upsertDefinition).toHaveBeenCalledTimes(1);
    expect(upsertDefinition).toHaveBeenCalledWith(payload);
  });

  it.each([
    {
      caseName: 'missing primaryTitle',
      params: (() => {
        const payload = buildValidUpsertPayload();
        delete payload.primaryTitle;
        return payload;
      })(),
    },
    {
      caseName: 'missing referenceDocumentId',
      params: (() => {
        const payload = buildValidUpsertPayload();
        delete payload.referenceDocumentId;
        return payload;
      })(),
    },
    {
      caseName: 'primaryTitle is not a string',
      params: buildValidUpsertPayload({ primaryTitle: 42 }),
    },
    {
      caseName: 'referenceDocumentId is not a string',
      params: buildValidUpsertPayload({ referenceDocumentId: { id: 'ref-doc-001' } }),
    },
    {
      caseName: 'templateDocumentId is not a string',
      params: buildValidUpsertPayload({ templateDocumentId: ['tpl-doc-001'] }),
    },
  ])(
    'rejects payloads missing required fields at the transport boundary: $caseName',
    ({ params }) => {
      const { upsertDefinition } = installAssignmentDefinitionControllerStub();
      const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionUpsertTransportModule();

      expect(() => upsertAssignmentDefinition_(params)).toThrow(ApiValidationError);
      expect(upsertDefinition).not.toHaveBeenCalled();
    }
  );

  it.each([
    { caseName: 'leading whitespace', definitionKey: ' definition-001' },
    { caseName: 'trailing whitespace', definitionKey: 'definition-001 ' },
    { caseName: 'contains slash', definitionKey: 'definition/001' },
    { caseName: 'contains backslash', definitionKey: 'definition\\001' },
    { caseName: 'contains dot-dot', definitionKey: 'definition..001' },
    { caseName: 'contains control character', definitionKey: 'definition\u0007-001' },
  ])(
    'rejects unsafe or untrimmed update definitionKey payloads at the transport boundary: $caseName',
    ({ definitionKey }) => {
      const { upsertDefinition } = installAssignmentDefinitionControllerStub();
      const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionUpsertTransportModule();

      expect(() => upsertAssignmentDefinition_(buildValidUpsertPayload({ definitionKey }))).toThrow(
        ApiValidationError
      );
      expect(upsertDefinition).not.toHaveBeenCalled();
    }
  );

  it.each([
    { caseName: 'taskWeightings is not an array', taskWeightings: 'bad-shape' },
    { caseName: 'taskWeightings item missing taskId', taskWeightings: [{ taskWeighting: 25 }] },
    {
      caseName: 'taskWeightings item has non-string taskId',
      taskWeightings: [{ taskId: 123, taskWeighting: 25 }],
    },
  ])(
    'rejects malformed taskWeightings payloads at the transport boundary: $caseName',
    ({ taskWeightings }) => {
      const { upsertDefinition } = installAssignmentDefinitionControllerStub();
      const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionUpsertTransportModule();

      expect(() =>
        upsertAssignmentDefinition_(buildValidUpsertPayload({ taskWeightings }))
      ).toThrow(ApiValidationError);
      expect(upsertDefinition).not.toHaveBeenCalled();
    }
  );

  it.each([
    { caseName: 'taskWeightings taskId is blank', taskId: '' },
    { caseName: 'taskWeightings taskId is whitespace only', taskId: '   ' },
    { caseName: 'taskWeightings taskId has leading whitespace', taskId: ' task-1' },
    { caseName: 'taskWeightings taskId has trailing whitespace', taskId: 'task-1 ' },
    { caseName: 'taskWeightings taskId contains slash', taskId: 'task/1' },
    { caseName: 'taskWeightings taskId contains backslash', taskId: 'task\\1' },
    { caseName: 'taskWeightings taskId contains dot-dot', taskId: 'task..1' },
    { caseName: 'taskWeightings taskId contains control character', taskId: 'task\u0007-1' },
  ])(
    'rejects unsafe taskWeightings taskId values at the transport boundary: $caseName',
    ({ taskId }) => {
      const { upsertDefinition } = installAssignmentDefinitionControllerStub();
      const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionUpsertTransportModule();

      expect(() =>
        upsertAssignmentDefinition_(
          buildValidUpsertPayload({ taskWeightings: [{ taskId, taskWeighting: 25 }] })
        )
      ).toThrow(ApiValidationError);
      expect(upsertDefinition).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      caseName: 'primaryTopicKey is missing',
      params: (() => {
        const payload = buildValidUpsertPayload();
        delete payload.primaryTopicKey;
        return payload;
      })(),
    },
    {
      caseName: 'primaryTopicKey is not a string',
      params: buildValidUpsertPayload({ primaryTopicKey: { key: 'topic-algebra' } }),
    },
    {
      caseName: 'primaryTopicKey has leading whitespace',
      params: buildValidUpsertPayload({ primaryTopicKey: ' topic-algebra' }),
    },
    {
      caseName: 'primaryTopicKey contains slash',
      params: buildValidUpsertPayload({ primaryTopicKey: 'topic/algebra' }),
    },
  ])(
    'rejects missing or malformed primaryTopicKey payload shape at the transport boundary: $caseName',
    ({ params }) => {
      const { upsertDefinition } = installAssignmentDefinitionControllerStub();
      const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionUpsertTransportModule();

      expect(() => upsertAssignmentDefinition_(params)).toThrow(ApiValidationError);
      expect(upsertDefinition).not.toHaveBeenCalled();
    }
  );

  it('reports indexed field metadata when taskWeightings taskId type is invalid', () => {
    const { upsertDefinition } = installAssignmentDefinitionControllerStub();
    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionUpsertTransportModule();

    try {
      upsertAssignmentDefinition_(
        buildValidUpsertPayload({
          taskWeightings: [{ taskId: 123, taskWeighting: 25 }],
        })
      );
      throw new Error('Expected upsertAssignmentDefinition_ to throw ApiValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiValidationError);
      expect(error.fieldName).toBe('taskWeightings[0].taskId');
      expect(upsertDefinition).not.toHaveBeenCalled();
    }
  });
});
