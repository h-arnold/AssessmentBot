import { describe, expect, it } from 'vitest';
import { AssignmentDefinitionPartialSchema } from './assignmentDefinitionPartials.zod';

describe('assignmentDefinitionPartials contract guard', () => {
  it('keeps the live partial DTO keyed by yearGroup during full-definition wiring', () => {
    const validRow = {
      definitionKey: 'algebra-baseline',
      primaryTitle: 'Algebra Baseline',
      primaryTopic: 'Algebra',
      yearGroup: 10,
      alternateTitles: ['Algebra Starter'],
      alternateTopics: ['Linear Equations'],
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-doc-id',
      templateDocumentId: 'tpl-doc-id',
      assignmentWeighting: 1,
      tasks: null,
      createdAt: '2026-01-05T10:00:00.000Z',
      updatedAt: null,
    };

    expect(AssignmentDefinitionPartialSchema.parse(validRow)).toEqual(validRow);
    expect(() =>
      AssignmentDefinitionPartialSchema.parse({
        ...validRow,
        yearGroupKey: 'year-10',
      })
    ).toThrow();
  });
});
