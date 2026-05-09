import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const modulePath = '../../src/backend/z_Api/assignmentDefinitionPartials.js';
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

function loadAssignmentDefinitionTransportModule() {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function installAssignmentDefinitionControllerStub() {
  const getDefinitionByKey = vi.fn();
  const AssignmentDefinitionController = vi.fn(function StubAssignmentDefinitionController() {
    this.getDefinitionByKey = getDefinitionByKey;
  });

  globalThis.AssignmentDefinitionController = AssignmentDefinitionController;

  return { AssignmentDefinitionController, getDefinitionByKey };
}

function buildCanonicalFullDefinition(overrides = {}) {
  return {
    definitionKey: 'definition-001',
    primaryTitle: 'Algebra Baseline',
    primaryTopicKey: 'topic-algebra',
    primaryTopic: 'Algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: ['Algebra Starter'],
    alternateTopics: ['Linear Equations'],
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

describe('Api/getAssignmentDefinition transport contract', () => {
  let originalAssignmentDefinitionController;

  beforeEach(() => {
    originalAssignmentDefinitionController = globalThis.AssignmentDefinitionController;
  });

  afterEach(() => {
    delete require.cache[require.resolve(modulePath)];

    if (originalAssignmentDefinitionController === undefined) {
      delete globalThis.AssignmentDefinitionController;
    } else {
      globalThis.AssignmentDefinitionController = originalAssignmentDefinitionController;
    }

    vi.restoreAllMocks();
  });

  it('exports getAssignmentDefinition_ as a callable read transport helper', () => {
    const transportModule = loadAssignmentDefinitionTransportModule();

    expect(transportModule.getAssignmentDefinition_).toEqual(expect.any(Function));
  });

  it('delegates safe definitionKey reads to AssignmentDefinitionController.getDefinitionByKey', () => {
    const { getDefinitionByKey } = installAssignmentDefinitionControllerStub();
    const transportModule = loadAssignmentDefinitionTransportModule();

    transportModule.getAssignmentDefinition_({ definitionKey: 'definition-001' });

    expect(getDefinitionByKey).toHaveBeenCalledWith('definition-001');
  });

  it('returns canonical full-definition read payloads with document IDs', () => {
    const { getDefinitionByKey } = installAssignmentDefinitionControllerStub();
    const canonicalDefinition = buildCanonicalFullDefinition();
    getDefinitionByKey.mockReturnValue(canonicalDefinition);

    const transportModule = loadAssignmentDefinitionTransportModule();
    const response = transportModule.getAssignmentDefinition_({ definitionKey: 'definition-001' });

    expect(response).toEqual(canonicalDefinition);
    expect(response).not.toHaveProperty('referenceDocumentUrl');
    expect(response).not.toHaveProperty('templateDocumentUrl');
  });

  it.each([
    { caseName: 'missing params', params: undefined },
    { caseName: 'missing definitionKey', params: {} },
    { caseName: 'blank definitionKey', params: { definitionKey: '   ' } },
    { caseName: 'unsafe definitionKey', params: { definitionKey: 'definition/001' } },
  ])('rejects invalid read payloads: $caseName', ({ params }) => {
    const { getDefinitionByKey } = installAssignmentDefinitionControllerStub();
    const transportModule = loadAssignmentDefinitionTransportModule();

    expect(() => transportModule.getAssignmentDefinition_(params)).toThrow(ApiValidationError);
    expect(getDefinitionByKey).not.toHaveBeenCalled();
  });
});
