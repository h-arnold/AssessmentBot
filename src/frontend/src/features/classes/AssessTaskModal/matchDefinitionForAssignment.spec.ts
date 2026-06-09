import { describe, expect, it } from 'vitest';
import type { AssignmentDefinitionPartial } from '../../../services/assignmentDefinitionPartials.zod';
import { findMatchingDefinition } from './matchDefinitionForAssignment';
import type { MatchResult } from './matchDefinitionForAssignment';

const DEFAULT_ISO_DATETIME = '2025-01-01T00:00:00.000Z';
const AMBIGUOUS_MATCH_COUNT = 2;

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

describe('findMatchingDefinition', () => {
  it('returns matched when primaryTitle, topicName, and yearGroupKey all align', () => {
    const selectedAssignment = {
      assignmentId: 'a-1',
      title: 'Essay',
      topicName: 'Writing',
    };

    const classPartial = { yearGroupKey: 'year-10' };

    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result: MatchResult = findMatchingDefinition(
      selectedAssignment,
      classPartial,
      definitionPartials
    );

    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') {
      expect(result.definition).toBe(definitionPartials[0]);
    }
  });

  it('returns matched when an alternateTitle, topicName, and yearGroupKey align', () => {
    const selectedAssignment = {
      assignmentId: 'a-2',
      title: 'Short Story',
      topicName: 'Writing',
    };

    const classPartial = { yearGroupKey: 'year-10' };

    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        alternateTitles: ['Short Story', 'Narrative'],
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result: MatchResult = findMatchingDefinition(
      selectedAssignment,
      classPartial,
      definitionPartials
    );

    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') {
      expect(result.definition).toBe(definitionPartials[0]);
    }
  });

  it('returns no-match when no definition has a matching title', () => {
    const selectedAssignment = {
      assignmentId: 'a-3',
      title: 'Book Report',
      topicName: 'Reading',
    };

    const classPartial = { yearGroupKey: 'year-10' };

    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Reading',
        yearGroupKey: 'year-10',
      }),
    ];

    const result: MatchResult = findMatchingDefinition(
      selectedAssignment,
      classPartial,
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });

  it('returns no-match when no definition has a matching topic', () => {
    const selectedAssignment = {
      assignmentId: 'a-4',
      title: 'Essay',
      topicName: 'Science',
    };

    const classPartial = { yearGroupKey: 'year-10' };

    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result: MatchResult = findMatchingDefinition(
      selectedAssignment,
      classPartial,
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });

  it('returns no-match when no definition has a matching year group', () => {
    const selectedAssignment = {
      assignmentId: 'a-5',
      title: 'Essay',
      topicName: 'Writing',
    };

    const classPartial = { yearGroupKey: 'year-11' };

    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result: MatchResult = findMatchingDefinition(
      selectedAssignment,
      classPartial,
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });

  it('returns no-match when selectedAssignment.topicName is null', () => {
    const selectedAssignment = {
      assignmentId: 'a-6',
      title: 'Essay',
      topicName: null,
    };

    const classPartial = { yearGroupKey: 'year-10' };

    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result: MatchResult = findMatchingDefinition(
      selectedAssignment,
      classPartial,
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });

  it('returns no-match when classPartial.yearGroupKey is null', () => {
    const selectedAssignment = {
      assignmentId: 'a-7',
      title: 'Essay',
      topicName: 'Writing',
    };

    const classPartial = { yearGroupKey: null };

    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result: MatchResult = findMatchingDefinition(
      selectedAssignment,
      classPartial,
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });

  it('returns ambiguous when multiple partials match all three criteria', () => {
    const selectedAssignment = {
      assignmentId: 'a-8',
      title: 'Essay',
      topicName: 'Writing',
    };

    const classPartial = { yearGroupKey: 'year-10' };

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

    const result: MatchResult = findMatchingDefinition(
      selectedAssignment,
      classPartial,
      definitionPartials
    );

    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.matches).toHaveLength(AMBIGUOUS_MATCH_COUNT);
      expect(result.matches).toEqual(definitionPartials);
    }
  });

  it('returns no-match when definitionPartials is an empty array', () => {
    const selectedAssignment = {
      assignmentId: 'a-9',
      title: 'Essay',
      topicName: 'Writing',
    };

    const classPartial = { yearGroupKey: 'year-10' };

    const definitionPartials: AssignmentDefinitionPartial[] = [];

    const result: MatchResult = findMatchingDefinition(
      selectedAssignment,
      classPartial,
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });

  it('only checks primaryTitle when alternateTitles is empty', () => {
    const selectedAssignment = {
      assignmentId: 'a-10',
      title: 'Non Matching Title',
      topicName: 'Writing',
    };

    const classPartial = { yearGroupKey: 'year-10' };

    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        alternateTitles: [],
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result: MatchResult = findMatchingDefinition(
      selectedAssignment,
      classPartial,
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });
});
