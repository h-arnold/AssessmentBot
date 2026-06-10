import { describe, expect, it } from 'vitest';
import type { AssignmentDefinitionPartial } from '../../../services/assignmentDefinitionPartials.zod';
import { findMatchingDefinition } from './matchDefinitionForAssignment';

const DEFAULT_ISO_DATETIME = '2025-01-01T00:00:00.000Z';

/**
 * Creates an AssignmentDefinitionPartial fixture with sensible defaults.
 *
 * Only `primaryTitle`, `primaryTopic`, and `yearGroupKey` are varied per test;
 * all other fields are fixed to reduce noise.
 *
 * @param {Partial<AssignmentDefinitionPartial>} overrides Fields to override on the default fixture.
 * @returns {AssignmentDefinitionPartial} An AssignmentDefinitionPartial fixture.
 */
function createFixture(
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
    documentType: 'test-document',
    referenceDocumentId: 'ref-001',
    templateDocumentId: 'tpl-001',
    assignmentWeighting: null,
    definitionKey: 'default-def-key',
    tasks: null,
    createdAt: DEFAULT_ISO_DATETIME,
    updatedAt: DEFAULT_ISO_DATETIME,
    ...overrides,
  };
}

const DEFAULT_SELECTED_ASSIGNMENT = {
  assignmentId: 'a-1',
  title: 'Essay',
  topicName: 'Writing',
};

const DEFAULT_CLASS_PARTIAL = { yearGroupKey: 'year-10' };

/**
 *
 * @param overrides
 */
/**
 * Creates a selected assignment fixture with sensible defaults.
 *
 * Only fields that differ from the default `Essay` / `Writing` assignment
 * need to be provided, reducing noise in each test case.
 *
 * @param {Partial<{ assignmentId: string; title: string; topicName: string | null }>} [overrides={}] Fields to override on the default fixture.
 * @returns {{ assignmentId: string; title: string; topicName: string | null }} A selected assignment fixture.
 */
function createSelectedAssignment(
  overrides: Partial<{ assignmentId: string; title: string; topicName: string | null }> = {}
): { assignmentId: string; title: string; topicName: string | null } {
  return { ...DEFAULT_SELECTED_ASSIGNMENT, ...overrides };
}

describe('findMatchingDefinition', () => {
  it('returns matched when primaryTitle, topicName, and yearGroupKey all align', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result = findMatchingDefinition(
      createSelectedAssignment(),
      DEFAULT_CLASS_PARTIAL,
      definitionPartials
    );

    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') {
      expect(result.definition).toBe(definitionPartials[0]);
    }
  });

  it('returns matched when an alternateTitle, topicName, and yearGroupKey align', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        alternateTitles: ['Short Story', 'Narrative'],
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result = findMatchingDefinition(
      createSelectedAssignment({ assignmentId: 'a-2', title: 'Short Story' }),
      DEFAULT_CLASS_PARTIAL,
      definitionPartials
    );

    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') {
      expect(result.definition).toBe(definitionPartials[0]);
    }
  });

  it('returns no-match when no definition has a matching title', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Reading',
        yearGroupKey: 'year-10',
      }),
    ];

    const result = findMatchingDefinition(
      createSelectedAssignment({ assignmentId: 'a-3', title: 'Book Report', topicName: 'Reading' }),
      DEFAULT_CLASS_PARTIAL,
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });

  it('returns no-match when no definition has a matching topic', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result = findMatchingDefinition(
      createSelectedAssignment({ assignmentId: 'a-4', topicName: 'Science' }),
      DEFAULT_CLASS_PARTIAL,
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });

  it('returns no-match when no definition has a matching year group', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result = findMatchingDefinition(
      createSelectedAssignment({ assignmentId: 'a-5' }),
      { yearGroupKey: 'year-11' },
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });

  it('returns no-match when selectedAssignment.topicName is null', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result = findMatchingDefinition(
      createSelectedAssignment({ assignmentId: 'a-6', topicName: null }),
      DEFAULT_CLASS_PARTIAL,
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });

  it('returns no-match when classPartial.yearGroupKey is null', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result = findMatchingDefinition(
      createSelectedAssignment({ assignmentId: 'a-7' }),
      { yearGroupKey: null },
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });

  it('returns ambiguous when multiple partials match all three criteria', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        definitionKey: 'def-1',
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
      createFixture({
        definitionKey: 'def-2',
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result = findMatchingDefinition(
      createSelectedAssignment({ assignmentId: 'a-8' }),
      DEFAULT_CLASS_PARTIAL,
      definitionPartials
    );

    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      expect(result.matches).toHaveLength(2);
      expect(result.matches).toEqual(definitionPartials);
    }
  });

  it('returns no-match when definitionPartials is an empty array', () => {
    const result = findMatchingDefinition(
      createSelectedAssignment({ assignmentId: 'a-9' }),
      DEFAULT_CLASS_PARTIAL,
      []
    );

    expect(result.kind).toBe('no-match');
  });

  it('only checks primaryTitle when alternateTitles is empty', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        alternateTitles: [],
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result = findMatchingDefinition(
      createSelectedAssignment({ assignmentId: 'a-10', title: 'Non Matching Title' }),
      DEFAULT_CLASS_PARTIAL,
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });
});
