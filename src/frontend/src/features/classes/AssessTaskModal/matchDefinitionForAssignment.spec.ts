import { describe, expect, it } from 'vitest';
import type { AssignmentDefinitionPartial } from '../../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { findMatchingDefinition } from './matchDefinitionForAssignment';
import {
  createFixture,
  createSelectedAssignment,
  DEFAULT_CLASS_PARTIAL,
  expectMatchedWithFixture,
} from '../../../test/classes/AssessTaskModal.test-utilities';

describe('findMatchingDefinition', () => {
  it('returns matched when primaryTitle, topicName, and yearGroupKey all align', () => {
    expectMatchedWithFixture({
      primaryTitle: 'Essay',
      primaryTopic: 'Writing',
      yearGroupKey: 'year-10',
    });
  });

  it('returns matched when an alternateTitle, topicName, and yearGroupKey align', () => {
    expectMatchedWithFixture(
      {
        primaryTitle: 'Essay',
        alternateTitles: ['Short Story', 'Narrative'],
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      },
      { assignmentId: 'a-2', title: 'Short Story' }
    );
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

  it('returns matched when primaryTitle differs only by case', () => {
    expectMatchedWithFixture(
      { primaryTitle: 'Essay', primaryTopic: 'Writing', yearGroupKey: 'year-10' },
      { assignmentId: 'a-11', title: 'essay' }
    );
  });

  it('returns matched when primaryTitle differs only by surrounding whitespace', () => {
    expectMatchedWithFixture(
      { primaryTitle: 'Essay', primaryTopic: 'Writing', yearGroupKey: 'year-10' },
      { assignmentId: 'a-12', title: '  Essay  ' }
    );
  });

  it('returns matched when an alternateTitle differs only by case', () => {
    expectMatchedWithFixture(
      {
        primaryTitle: 'Essay',
        alternateTitles: ['Narrative'],
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      },
      { assignmentId: 'a-13', title: 'NARRATIVE' }
    );
  });

  it('returns matched when primaryTopic differs only by case', () => {
    expectMatchedWithFixture(
      { primaryTitle: 'Essay', primaryTopic: 'Algebra', yearGroupKey: 'year-10' },
      { assignmentId: 'a-14', topicName: 'algebra' }
    );
  });

  it('returns matched when an alternateTopic matches the assignment topic case-insensitively', () => {
    expectMatchedWithFixture(
      {
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        alternateTopics: ['Linear Equations'],
        yearGroupKey: 'year-10',
      },
      { assignmentId: 'a-15', topicName: 'linear equations' }
    );
  });

  it('returns matched when primaryTopic differs only by surrounding whitespace', () => {
    expectMatchedWithFixture(
      { primaryTitle: 'Essay', primaryTopic: 'Algebra', yearGroupKey: 'year-10' },
      { assignmentId: 'a-16', topicName: '  Algebra  ' }
    );
  });

  it('does not match when the case-insensitive title aligns but the topic differs', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result = findMatchingDefinition(
      createSelectedAssignment({ assignmentId: 'a-17', title: 'ESSAY', topicName: 'Reading' }),
      DEFAULT_CLASS_PARTIAL,
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });

  it('does not match when the case-insensitive title aligns but the year group differs', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result = findMatchingDefinition(
      createSelectedAssignment({ assignmentId: 'a-18', title: 'ESSAY' }),
      { yearGroupKey: 'year-11' },
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });

  it('returns no-match when topicName is null regardless of case-insensitive title match', () => {
    const definitionPartials: AssignmentDefinitionPartial[] = [
      createFixture({
        primaryTitle: 'Essay',
        primaryTopic: 'Writing',
        yearGroupKey: 'year-10',
      }),
    ];

    const result = findMatchingDefinition(
      createSelectedAssignment({ assignmentId: 'a-19', title: 'ESSAY', topicName: null }),
      DEFAULT_CLASS_PARTIAL,
      definitionPartials
    );

    expect(result.kind).toBe('no-match');
  });
});
