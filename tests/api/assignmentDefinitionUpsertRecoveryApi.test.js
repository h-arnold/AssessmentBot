import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loadApiHandlerModule,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
} = require('../helpers/apiHandlerTestUtils.js');

// RED phase for the stale-recovery upsert transport (issue #301). The
// dispatcher allowlist must carry the new recovery parameters through to the
// transport handler end to end, and the transport boundary must validate the
// new field shapes before the controller runs.
describe('Api/upsertAssignmentDefinition — recovery parameter transport through apiHandler', () => {
  let context;
  let upsertDefinition;
  let getFullAssignmentDefinition;
  let originalAssignmentDefinitionController;
  let originalUpsertAssignmentDefinition;

  function buildRecoveryPayload(overrides = {}) {
    return {
      primaryTitle: 'Algebra Baseline',
      primaryTopicKey: 'topic-algebra',
      yearGroupKey: 'year-group-10',
      definitionKey: 'definition-001',
      referenceDocumentId: 'ref-doc-001',
      templateDocumentId: 'tpl-doc-001',
      assignmentWeighting: 1,
      ...overrides,
    };
  }

  function buildFullDefinition(overrides = {}) {
    return {
      definitionKey: 'definition-001',
      primaryTitle: 'Algebra Baseline',
      primaryTopicKey: 'topic-algebra',
      primaryTopic: 'Algebra',
      yearGroupKey: 'year-group-10',
      yearGroupLabel: 'Year 10',
      alternateTitles: [],
      alternateTopics: [],
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-doc-001',
      templateDocumentId: 'tpl-doc-001',
      assignmentWeighting: 1,
      tasks: [{ taskId: 'task-1', taskTitle: 'Task 1', taskWeighting: 1 }],
      createdAt: '2026-01-05T10:00:00.000Z',
      updatedAt: '2026-01-06T12:30:00.000Z',
      ...overrides,
    };
  }

  beforeEach(() => {
    context = setupApiHandlerTestContext(vi, {});

    // Stub the controller behind the real transport handler so assertions
    // observe exactly what the transport layer forwards.
    originalAssignmentDefinitionController = globalThis.AssignmentDefinitionController;
    upsertDefinition = vi.fn();
    getFullAssignmentDefinition = vi.fn((definition) => definition);
    globalThis.AssignmentDefinitionController = vi.fn(
      function StubAssignmentDefinitionController() {
        this.upsertDefinition = upsertDefinition;
        this.getFullAssignmentDefinition = getFullAssignmentDefinition;
      }
    );

    // Bind the real transport handler into the dispatcher path.
    originalUpsertAssignmentDefinition = globalThis.upsertAssignmentDefinition_;
    delete require.cache[
      require.resolve('../../src/backend/z_Api/assignmentDefinitionTransport.js')
    ];
    globalThis.upsertAssignmentDefinition_ =
      require('../../src/backend/z_Api/assignmentDefinitionTransport.js').upsertAssignmentDefinition_;
  });

  afterEach(() => {
    delete require.cache[
      require.resolve('../../src/backend/z_Api/assignmentDefinitionTransport.js')
    ];

    if (originalAssignmentDefinitionController === undefined) {
      delete globalThis.AssignmentDefinitionController;
    } else {
      globalThis.AssignmentDefinitionController = originalAssignmentDefinitionController;
    }

    if (originalUpsertAssignmentDefinition === undefined) {
      delete globalThis.upsertAssignmentDefinition_;
    } else {
      globalThis.upsertAssignmentDefinition_ = originalUpsertAssignmentDefinition;
    }

    teardownApiHandlerTestContext(vi, context);
  });

  it('passes forceReparse and expectedDefinitionUpdatedAt through to the controller', () => {
    const expectedDefinition = buildFullDefinition();
    upsertDefinition.mockReturnValue(expectedDefinition);
    const params = buildRecoveryPayload({
      forceReparse: true,
      expectedDefinitionUpdatedAt: '2026-01-06T12:30:00.000Z',
    });

    const { ApiDispatcher } = loadApiHandlerModule();
    const response = ApiDispatcher.getInstance().handle({
      method: 'upsertAssignmentDefinition',
      params,
    });

    expect(response.ok).toBe(true);
    expect(response.data).toEqual(expectedDefinition);
    expect(upsertDefinition).toHaveBeenCalledTimes(1);
    expect(upsertDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        forceReparse: true,
        expectedDefinitionUpdatedAt: '2026-01-06T12:30:00.000Z',
      })
    );
  });

  it('rejects a non-boolean forceReparse value without reaching the controller', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const response = ApiDispatcher.getInstance().handle({
      method: 'upsertAssignmentDefinition',
      params: buildRecoveryPayload({ forceReparse: 'yes' }),
    });

    expect(response.ok).toBe(false);
    expect(response.error.code).toBe('INVALID_REQUEST');
    expect(response.error.message).toMatch(/forceReparse/i);
    expect(upsertDefinition).not.toHaveBeenCalled();
  });

  it('rejects a non-string expectedDefinitionUpdatedAt baseline without reaching the controller', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const response = ApiDispatcher.getInstance().handle({
      method: 'upsertAssignmentDefinition',
      params: buildRecoveryPayload({ expectedDefinitionUpdatedAt: 12345 }),
    });

    expect(response.ok).toBe(false);
    expect(response.error.code).toBe('INVALID_REQUEST');
    expect(response.error.message).toMatch(/expectedDefinitionUpdatedAt/i);
    expect(upsertDefinition).not.toHaveBeenCalled();
  });
});
