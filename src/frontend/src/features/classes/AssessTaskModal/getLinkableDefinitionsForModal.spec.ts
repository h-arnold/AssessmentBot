import { describe, expect, it } from 'vitest';
import type { AssignmentDefinitionPartial } from '../../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { getLinkableDefinitionsForModal } from './getLinkableDefinitionsForModal';

const DEFAULT_ISO_DATETIME = '2025-01-01T00:00:00.000Z';

/**
 * Creates an AssignmentDefinitionPartial fixture with sensible defaults.
 *
 * @param {Partial<AssignmentDefinitionPartial>} overrides Fields to override on the default fixture.
 * @returns {AssignmentDefinitionPartial} A partial fixture.
 */
function createPartial(
  overrides: Partial<AssignmentDefinitionPartial> = {}
): AssignmentDefinitionPartial {
  return {
    primaryTitle: 'Default Title',
    primaryTopic: 'Default Topic',
    primaryTopicKey: 'default-topic-key',
    yearGroupKey: 'year-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-001',
    templateDocumentId: 'tpl-001',
    assignmentWeighting: null,
    definitionKey: 'default-def-key',
    tasks: [],
    createdAt: DEFAULT_ISO_DATETIME,
    updatedAt: DEFAULT_ISO_DATETIME,
    ...overrides,
  };
}

const DEFAULT_SELECTED_ASSIGNMENT = {
  title: 'Algebra HW',
  topicName: 'Algebra',
};

const DEFAULT_CLASS_YEAR_GROUP_KEY = 'year-10';

describe('getLinkableDefinitionsForModal', () => {
  it('returns an empty array when definitionPartials is empty', () => {
    const result = getLinkableDefinitionsForModal(
      [],
      DEFAULT_CLASS_YEAR_GROUP_KEY,
      DEFAULT_SELECTED_ASSIGNMENT
    );
    expect(result).toEqual([]);
  });

  it('drops partials whose yearGroupKey does not match the class year group', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createPartial({ definitionKey: 'def-1', yearGroupKey: 'year-11' }),
      createPartial({ definitionKey: 'def-2', yearGroupKey: 'year-12' }),
    ];

    const result = getLinkableDefinitionsForModal(
      definitionPartials,
      DEFAULT_CLASS_YEAR_GROUP_KEY,
      DEFAULT_SELECTED_ASSIGNMENT
    );

    expect(result).toEqual([]);
  });

  it('returns a single LinkableDefinition when only one partial matches the year group', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createPartial({
        definitionKey: 'def-1',
        primaryTitle: 'Algebra HW',
        primaryTopic: 'Algebra',
      }),
    ];

    const result = getLinkableDefinitionsForModal(
      definitionPartials,
      DEFAULT_CLASS_YEAR_GROUP_KEY,
      DEFAULT_SELECTED_ASSIGNMENT
    );

    expect(result).toHaveLength(1);
    const first = result[0];
    expect(first.definitionKey).toBe('def-1');
    expect(first.primaryTitle).toBe('Algebra HW');
    expect(first.primaryTopic).toBe('Algebra');
    expect(first.yearGroupKey).toBe('year-10');
    expect(first.yearGroupLabel).toBe('Year 10');
  });

  it('ranks the closest primaryTitle first when titles differ', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createPartial({
        definitionKey: 'poetry',
        primaryTitle: 'Poetry Analysis',
      }),
      createPartial({
        definitionKey: 'algebra-hw',
        primaryTitle: 'Algebra HW',
      }),
      createPartial({
        definitionKey: 'algebra-hw-full',
        primaryTitle: 'Algebra Homework',
      }),
    ];

    const result = getLinkableDefinitionsForModal(
      definitionPartials,
      DEFAULT_CLASS_YEAR_GROUP_KEY,
      DEFAULT_SELECTED_ASSIGNMENT
    );

    expect(result.map((entry) => entry.definitionKey)).toEqual([
      'algebra-hw',
      'algebra-hw-full',
      'poetry',
    ]);
  });

  it('breaks equal scores by updatedAt desc', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createPartial({
        definitionKey: 'algebra-older',
        primaryTitle: 'Algebra HW',
        updatedAt: '2025-01-01T00:00:00.000Z',
      }),
      createPartial({
        definitionKey: 'algebra-newer',
        primaryTitle: 'Algebra HW',
        updatedAt: '2025-01-03T00:00:00.000Z',
      }),
    ];

    const result = getLinkableDefinitionsForModal(
      definitionPartials,
      DEFAULT_CLASS_YEAR_GROUP_KEY,
      DEFAULT_SELECTED_ASSIGNMENT
    );

    // The two partials are perfect matches for the same primaryTitle
    // (score 0); the tie-breaker is `updatedAt` desc.
    expect(result.map((entry) => entry.definitionKey)).toEqual(['algebra-newer', 'algebra-older']);
  });

  it('keeps unrelated titles in the result (threshold 1.0)', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createPartial({
        definitionKey: 'poetry',
        primaryTitle: 'Poetry Analysis',
      }),
    ];

    const result = getLinkableDefinitionsForModal(
      definitionPartials,
      DEFAULT_CLASS_YEAR_GROUP_KEY,
      DEFAULT_SELECTED_ASSIGNMENT
    );

    // The unrelated title still appears in the picker (worse score,
    // but never filtered out by score).
    expect(result).toHaveLength(1);
    expect(result[0]?.definitionKey).toBe('poetry');
  });

  it('drops partials whose referenceDocumentId is null', () => {
    const partialWithNullDocumentId = {
      ...createPartial({}),
      referenceDocumentId: null,
    } as unknown as AssignmentDefinitionPartial;

    const result = getLinkableDefinitionsForModal(
      [partialWithNullDocumentId],
      DEFAULT_CLASS_YEAR_GROUP_KEY,
      DEFAULT_SELECTED_ASSIGNMENT
    );

    expect(result).toEqual([]);
  });

  it('drops partials whose templateDocumentId is null', () => {
    const partialWithNullTemplateId = {
      ...createPartial({}),
      templateDocumentId: null,
    } as unknown as AssignmentDefinitionPartial;

    const result = getLinkableDefinitionsForModal(
      [partialWithNullTemplateId],
      DEFAULT_CLASS_YEAR_GROUP_KEY,
      DEFAULT_SELECTED_ASSIGNMENT
    );

    expect(result).toEqual([]);
  });

  it('keeps partials when both referenceDocumentId and templateDocumentId are non-null strings', () => {
    const partialWithBothIds = createPartial({
      definitionKey: 'keep-me',
      referenceDocumentId: 'ref-002',
      templateDocumentId: 'tpl-002',
    });

    const result = getLinkableDefinitionsForModal(
      [partialWithBothIds],
      DEFAULT_CLASS_YEAR_GROUP_KEY,
      DEFAULT_SELECTED_ASSIGNMENT
    );

    expect(result).toHaveLength(1);
    expect(result[0].definitionKey).toBe('keep-me');
    expect(result[0].referenceDocumentId).toBe('ref-002');
    expect(result[0].templateDocumentId).toBe('tpl-002');
  });

  it('does not throw when partials have null primaryTitle or primaryTopic', () => {
    // The schema enforces non-null primaryTitle, but the helper is a pure
    // function and should handle a hypothetical malformed input without
    // throwing (defensive coersion).
    const definitionPartials = [
      {
        ...createPartial({ definitionKey: 'def-1' }),
        primaryTitle: '' as unknown as string,
        primaryTopic: '' as unknown as string,
        alternateTitles: undefined as unknown as string[],
        alternateTopics: undefined as unknown as string[],
        updatedAt: null,
      },
    ];

    const result = getLinkableDefinitionsForModal(
      definitionPartials,
      DEFAULT_CLASS_YEAR_GROUP_KEY,
      DEFAULT_SELECTED_ASSIGNMENT
    );

    expect(result[0].primaryTitle).toBe('');
    expect(result[0].primaryTopic).toBe('');
    expect(result[0].updatedAt).toBe('');
    expect(result[0].alternateTitles).toEqual([]);
    expect(result[0].alternateTopics).toEqual([]);
  });
});
