/**
 * @remarks This spec no longer enforces the `tasks → null` collapsing contract
 * for the list-surface DTO. The post-extension AssignmentDefinitionPartial now
 * carries real `TaskPartial[]` data validated by
 * `assignmentDefinitionPartials.zod.spec.ts`. The second test
 * (`'accepts backend-compatible non-null tasks payloads and collapses them to
 * null in the list-surface DTO'`) was deleted in Section 4 because the
 * collapsing transform was removed from the canonical schema.
 */
import { describe, expect, it } from 'vitest';
import { AssignmentDefinitionPartialSchema } from './assignmentDefinitionPartials.zod';

describe('assignmentDefinitionPartials contract guard', () => {
  it('keeps list-surface DTO keyed by yearGroupKey/yearGroupLabel', () => {
    const validRow = {
      definitionKey: 'algebra-baseline',
      primaryTitle: 'Algebra Baseline',
      primaryTopic: 'Algebra',
      primaryTopicKey: 'topic-algebra',
      yearGroupKey: 'year-group-10',
      yearGroupLabel: 'Year 10',
      alternateTitles: ['Algebra Starter'],
      alternateTopics: ['Linear Equations'],
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-doc-id',
      templateDocumentId: 'tpl-doc-id',
      assignmentWeighting: 1,
      tasks: [],
      createdAt: '2026-01-05T10:00:00.000Z',
      updatedAt: null,
    };

    expect(AssignmentDefinitionPartialSchema.parse(validRow)).toEqual(validRow);
    expect(() =>
      AssignmentDefinitionPartialSchema.parse({
        ...validRow,
        yearGroup: 10,
      })
    ).toThrow();
  });
});
