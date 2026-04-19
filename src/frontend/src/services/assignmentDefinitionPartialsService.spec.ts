import { ZodError } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.fn();

vi.mock('./apiService', () => ({
  callApi: callApiMock,
}));

const validAssignmentDefinitionPartialsResponse = [
  {
    primaryTitle: 'Algebra Baseline',
    primaryTopic: 'Algebra',
    yearGroup: 10,
    alternateTitles: ['Algebra Starter'],
    alternateTopics: ['Linear Equations'],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-doc-001',
    templateDocumentId: 'tpl-doc-001',
    assignmentWeighting: null,
    definitionKey: 'algebra-baseline',
    tasks: null,
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: null,
  },
];

const deleteRequestPayload = {
  definitionKey: 'algebra-baseline',
};

const omittedBackendSuccessPayload = new Map<string, never>().get('missing');

/**
 * Loads the assignment-definition partial service module under test.
 *
 * @returns {Promise<typeof import('./assignmentDefinitionPartialsService')>} The imported service module.
 */
async function loadAssignmentDefinitionPartialsService() {
  return import('./assignmentDefinitionPartialsService');
}

describe('assignmentDefinitionPartialsService', () => {
  afterEach(() => {
    callApiMock.mockReset();
    vi.resetModules();
  });

  it('getAssignmentDefinitionPartials() delegates to callApi and parses backend payloads through the response schema', async () => {
    callApiMock.mockResolvedValueOnce(validAssignmentDefinitionPartialsResponse);

    const { getAssignmentDefinitionPartials } = await loadAssignmentDefinitionPartialsService();

    await expect(getAssignmentDefinitionPartials()).resolves.toEqual(
      validAssignmentDefinitionPartialsResponse
    );
    expect(callApiMock).toHaveBeenCalledWith('getAssignmentDefinitionPartials');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('getAssignmentDefinitionPartials() rejects malformed backend payloads instead of exposing raw transport data', async () => {
    callApiMock.mockResolvedValueOnce([
      {
        primaryTitle: 'Algebra Baseline',
        primaryTopic: 'Algebra',
        definitionKey: ' algebra-baseline ',
      },
    ]);

    const { getAssignmentDefinitionPartials } = await loadAssignmentDefinitionPartialsService();

    await expect(getAssignmentDefinitionPartials()).rejects.toBeInstanceOf(ZodError);
    expect(callApiMock).toHaveBeenCalledWith('getAssignmentDefinitionPartials');
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it('deleteAssignmentDefinition() delegates to callApi with a schema-valid definition key', async () => {
    callApiMock.mockResolvedValueOnce(omittedBackendSuccessPayload);

    const { deleteAssignmentDefinition } = await loadAssignmentDefinitionPartialsService();

    await expect(deleteAssignmentDefinition(deleteRequestPayload)).resolves.toBeUndefined();
    expect(callApiMock).toHaveBeenCalledWith('deleteAssignmentDefinition', deleteRequestPayload);
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { definitionKey: '' },
    { definitionKey: '   ' },
    { definitionKey: ' algebra-baseline ' },
    { definitionKey: 'algebra/baseline' },
    { definitionKey: String.raw`algebra\baseline` },
    { definitionKey: 'algebra..baseline' },
    { definitionKey: 'algebra\u0007baseline' },
    {},
  ])('deleteAssignmentDefinition() rejects malformed definitionKey payloads before callApi: %j', async (input) => {
    const { deleteAssignmentDefinition } = await loadAssignmentDefinitionPartialsService();

    await expect(deleteAssignmentDefinition(input as Parameters<typeof deleteAssignmentDefinition>[0])).rejects.toBeInstanceOf(ZodError);
    expect(callApiMock).not.toHaveBeenCalled();
  });

  it('deleteAssignmentDefinition() rejects unexpected backend success payload data', async () => {
    callApiMock.mockResolvedValueOnce({ deleted: true });

    const { deleteAssignmentDefinition } = await loadAssignmentDefinitionPartialsService();

    await expect(deleteAssignmentDefinition(deleteRequestPayload)).rejects.toBeInstanceOf(ZodError);
    expect(callApiMock).toHaveBeenCalledWith('deleteAssignmentDefinition', deleteRequestPayload);
    expect(callApiMock).toHaveBeenCalledTimes(1);
  });
});
