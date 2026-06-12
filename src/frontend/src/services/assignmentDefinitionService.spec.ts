import { ZodError } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.fn();

vi.mock('./apiService', () => ({
  callApi: callApiMock,
}));

const upsertInput = {
  primaryTitle: 'Algebra Baseline',
  primaryTopicKey: 'topic-algebra',
  yearGroupKey: 'year-10',
  referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref-doc-id/edit',
  templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl-doc-id/edit',
  assignmentWeighting: 1,
  taskWeightings: [{ taskId: 'task-001', taskWeighting: 1 }],
};

const fullDefinitionResponse = {
  definitionKey: 'algebra-baseline',
  primaryTitle: 'Algebra Baseline',
  primaryTopicKey: 'topic-algebra',
  primaryTopic: 'Algebra',
  yearGroupKey: 'year-10',
  yearGroupLabel: 'Year 10',
  alternateTitles: ['Algebra Starter'],
  alternateTopics: ['Linear Equations'],
  documentType: 'SLIDES',
  referenceDocumentId: 'reference-doc-id',
  templateDocumentId: 'template-doc-id',
  assignmentWeighting: 1,
  tasks: [{ taskId: 'task-001', taskTitle: 'Solve equations', taskWeighting: 1 }],
  createdAt: '2026-01-05T10:00:00.000Z',
  updatedAt: '2026-01-05T10:10:00.000Z',
};

/**
 * Loads the assignment-definition service module under test.
 *
 * @returns {Promise<Record<string, (...arguments_: unknown[]) => Promise<unknown>>>
 * } Imported service module.
 */
async function loadAssignmentDefinitionService() {
  return import('./assignmentDefinitionService') as Promise<
    Record<string, (...arguments_: unknown[]) => Promise<unknown>>
  >;
}

describe('assignmentDefinitionService', () => {
  afterEach(() => {
    callApiMock.mockReset();
    vi.resetModules();
  });

  it('upsertAssignmentDefinition() delegates to callApi and validates the response contract', async () => {
    callApiMock.mockResolvedValueOnce(fullDefinitionResponse);

    const service = await loadAssignmentDefinitionService();
    const upsertAssignmentDefinition = service.upsertAssignmentDefinition;

    await expect(upsertAssignmentDefinition(upsertInput)).resolves.toEqual(fullDefinitionResponse);
    expect(callApiMock).toHaveBeenCalledWith('upsertAssignmentDefinition', upsertInput);
  });

  it('getAssignmentDefinition() delegates to callApi with definitionKey request payload', async () => {
    callApiMock.mockResolvedValueOnce(fullDefinitionResponse);

    const service = await loadAssignmentDefinitionService();
    const getAssignmentDefinition = service.getAssignmentDefinition;

    await expect(getAssignmentDefinition({ definitionKey: 'algebra-baseline' })).resolves.toEqual(
      fullDefinitionResponse
    );
    expect(callApiMock).toHaveBeenCalledWith('getAssignmentDefinition', {
      definitionKey: 'algebra-baseline',
    });
  });

  it('rejects malformed upsert payloads before transport calls', async () => {
    const service = await loadAssignmentDefinitionService();
    const upsertAssignmentDefinition = service.upsertAssignmentDefinition;

    await expect(
      upsertAssignmentDefinition({
        ...upsertInput,
        assignmentWeighting: 12,
      })
    ).rejects.toBeInstanceOf(ZodError);
    expect(callApiMock).not.toHaveBeenCalled();
  });

  it('rejects malformed full-definition responses returned by transport wrappers', async () => {
    callApiMock.mockResolvedValueOnce({ definitionKey: 'algebra-baseline' });

    const service = await loadAssignmentDefinitionService();
    const getAssignmentDefinition = service.getAssignmentDefinition;

    await expect(
      getAssignmentDefinition({ definitionKey: 'algebra-baseline' })
    ).rejects.toBeInstanceOf(ZodError);
    expect(callApiMock).toHaveBeenCalledWith('getAssignmentDefinition', {
      definitionKey: 'algebra-baseline',
    });
  });
});
