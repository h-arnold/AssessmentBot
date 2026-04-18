import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const modulePath = '../../src/backend/z_Api/assignmentDefinitionPartials.js';
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

function loadAssignmentDefinitionPartialsModule() {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function installAssignmentDefinitionControllerStub() {
  const deleteDefinitionByKey = vi.fn();
  const AssignmentDefinitionController = vi.fn(function StubAssignmentDefinitionController() {
    this.deleteDefinitionByKey = deleteDefinitionByKey;
  });

  globalThis.AssignmentDefinitionController = AssignmentDefinitionController;

  return { AssignmentDefinitionController, deleteDefinitionByKey };
}

describe('Api/deleteAssignmentDefinition transport contract', () => {
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

  it('deletes registry and full-store targets for a safe definitionKey', () => {
    const { AssignmentDefinitionController, deleteDefinitionByKey } =
      installAssignmentDefinitionControllerStub();
    const { deleteAssignmentDefinition } = loadAssignmentDefinitionPartialsModule();

    const result = deleteAssignmentDefinition({ definitionKey: 'algebra-baseline' });

    expect(result).toBeUndefined();
    expect(AssignmentDefinitionController).toHaveBeenCalledTimes(1);
    expect(deleteDefinitionByKey).toHaveBeenCalledTimes(1);
    expect(deleteDefinitionByKey).toHaveBeenCalledWith('algebra-baseline');
  });

  it('treats safe-key deletes as idempotent when records are already absent', () => {
    const { deleteDefinitionByKey } = installAssignmentDefinitionControllerStub();
    const { deleteAssignmentDefinition } = loadAssignmentDefinitionPartialsModule();

    expect(() => deleteAssignmentDefinition({ definitionKey: 'algebra-baseline' })).not.toThrow();
    expect(() => deleteAssignmentDefinition({ definitionKey: 'algebra-baseline' })).not.toThrow();

    expect(deleteDefinitionByKey).toHaveBeenCalledTimes(2);
    expect(deleteDefinitionByKey).toHaveBeenNthCalledWith(1, 'algebra-baseline');
    expect(deleteDefinitionByKey).toHaveBeenNthCalledWith(2, 'algebra-baseline');
  });

  it.each([
    {
      caseName: 'definitionKey is empty',
      params: { definitionKey: '' },
    },
    {
      caseName: 'definitionKey is whitespace only',
      params: { definitionKey: '   ' },
    },
    {
      caseName: 'definitionKey has leading whitespace',
      params: { definitionKey: ' algebra-baseline' },
    },
    {
      caseName: 'definitionKey has trailing whitespace',
      params: { definitionKey: 'algebra-baseline ' },
    },
  ])('rejects invalid trimmed-shape key: $caseName', ({ params }) => {
    const { deleteDefinitionByKey } = installAssignmentDefinitionControllerStub();
    const { deleteAssignmentDefinition } = loadAssignmentDefinitionPartialsModule();

    expect(() => deleteAssignmentDefinition(params)).toThrow(ApiValidationError);
    expect(deleteDefinitionByKey).not.toHaveBeenCalled();
  });

  it.each([
    {
      caseName: 'contains forward slash',
      params: { definitionKey: 'topic/algebra' },
    },
    {
      caseName: 'contains backslash',
      params: { definitionKey: 'topic\\algebra' },
    },
    {
      caseName: 'contains dot-dot traversal token',
      params: { definitionKey: 'topic..algebra' },
    },
    {
      caseName: 'contains control character',
      params: { definitionKey: 'topic\u0007algebra' },
    },
  ])('rejects unsafe key tokens: $caseName', ({ params }) => {
    const { deleteDefinitionByKey } = installAssignmentDefinitionControllerStub();
    const { deleteAssignmentDefinition } = loadAssignmentDefinitionPartialsModule();

    expect(() => deleteAssignmentDefinition(params)).toThrow(ApiValidationError);
    expect(deleteDefinitionByKey).not.toHaveBeenCalled();
  });
});
