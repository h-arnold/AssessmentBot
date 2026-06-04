/**
 * Test fixtures for assignmentDefinitionPartials.zod spec.
 */

export type AssignmentDefinitionPartialFixture = {
  primaryTitle: string;
  primaryTopicKey: string;
  primaryTopic: string;
  yearGroupKey: string;
  yearGroupLabel: string;
  alternateTitles: string[];
  alternateTopics: string[];
  documentType: string;
  referenceDocumentId: string;
  templateDocumentId: string;
  assignmentWeighting: number | null;
  definitionKey: string;
  tasks: null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const omittedBackendSuccessPayload = new Map<string, never>().get('missing');

export const validAssignmentDefinitionPartialRow: AssignmentDefinitionPartialFixture = {
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
  assignmentWeighting: null,
  definitionKey: 'algebra-baseline',
  tasks: null,
  createdAt: '2026-01-05T10:00:00.000Z',
  updatedAt: null,
};

/**
 * Loads the assignment-definition partial schemas under test.
 *
 * @returns {Promise<Record<string, unknown>>} The imported schema module.
 */
export async function loadAssignmentDefinitionPartialsSchemas(): Promise<Record<string, unknown>> {
  return import('../assignmentDefinitionPartials.zod');
}

/**
 * Creates a mutable row fixture for malformed-payload cases.
 *
 * @returns {AssignmentDefinitionPartialFixture} A cloned valid row fixture.
 */
export function createMutableRowFixture(): AssignmentDefinitionPartialFixture {
  return { ...validAssignmentDefinitionPartialRow };
}

/**
 * Casts an unknown schema export to a parser shape.
 *
 * @param {unknown} schemaExport - Schema export under test.
 * @returns {{ parse: (input: unknown) => unknown }} Parser-compatible schema facade.
 */
export function asParserSchema(schemaExport: unknown): { parse: (input: unknown) => unknown } {
  return schemaExport as { parse: (input: unknown) => unknown };
}
