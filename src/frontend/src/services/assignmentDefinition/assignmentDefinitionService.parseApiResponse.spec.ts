import { ZodError } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAssignmentDefinition, upsertAssignmentDefinition } from './assignmentDefinitionService';

const { callApiMock } = vi.hoisted(() => ({ callApiMock: vi.fn() }));

vi.mock('../apiService', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    callApi: callApiMock,
  };
});

const upsertInput = {
  primaryTitle: 'Algebra Baseline',
  primaryTopicKey: 'topic-algebra',
  yearGroupKey: 'year-10',
  referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref-doc-id/edit',
  templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl-doc-id/edit',
  assignmentWeighting: 1,
};

/**
 * Finds console.error entries emitted through the shared service-validation helper.
 *
 * @param {ReturnType<typeof vi.spyOn>} consoleErrorSpy - The console error spy.
 * @returns {Array<Record<string, unknown>>} Matching log entries.
 */
function findParseApiResponseEntries(
  consoleErrorSpy: ReturnType<typeof vi.spyOn>
): Array<Record<string, unknown>> {
  return consoleErrorSpy.mock.calls
    .filter(([context]: unknown[]) => context === 'services/apiService.parseApiResponse')
    .map(([, entry]: unknown[]) => entry as Record<string, unknown>);
}

describe('assignmentDefinitionService service-validation diagnostics', () => {
  afterEach(() => {
    callApiMock.mockReset();
    vi.restoreAllMocks();
  });

  it('reports getAssignmentDefinition schema failures with method and bounded diagnostics', async () => {
    callApiMock.mockImplementation(() => Promise.resolve({ definitionKey: 'algebra-baseline' }));
    const consoleErrorSpy = vi.spyOn(console, 'error');

    await expect(
      getAssignmentDefinition({ definitionKey: 'algebra-baseline' })
    ).rejects.toBeInstanceOf(ZodError);

    const entries = findParseApiResponseEntries(consoleErrorSpy);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    for (const entry of entries) {
      const metadata = entry.metadata as Record<string, unknown>;
      expect(metadata).toMatchObject({ method: 'getAssignmentDefinition' });
      expect(metadata).toHaveProperty('zodIssues');
      expect(metadata).toHaveProperty('responsePreview');
    }
  });

  it('reports upsertAssignmentDefinition schema failures with method and bounded diagnostics', async () => {
    callApiMock.mockImplementation(() => Promise.resolve({ definitionKey: 'algebra-baseline' }));
    const consoleErrorSpy = vi.spyOn(console, 'error');

    await expect(upsertAssignmentDefinition(upsertInput)).rejects.toBeInstanceOf(ZodError);

    const entries = findParseApiResponseEntries(consoleErrorSpy);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    for (const entry of entries) {
      const metadata = entry.metadata as Record<string, unknown>;
      expect(metadata).toMatchObject({ method: 'upsertAssignmentDefinition' });
      expect(metadata).toHaveProperty('zodIssues');
      expect(metadata).toHaveProperty('responsePreview');
    }
  });
});
