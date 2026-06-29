import type { AssignmentDefinitionPartial } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { findMatchingDefinition } from '../../features/classes/AssessTaskModal/matchDefinitionForAssignment';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_ISO_DATETIME = '2025-01-01T00:00:00.000Z';

export const DEFAULT_SELECTED_ASSIGNMENT = {
  assignmentId: 'a-1',
  title: 'Essay',
  topicName: 'Writing',
};

export const DEFAULT_CLASS_PARTIAL = { yearGroupKey: 'year-10' };

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

/**
 * Creates an AssignmentDefinitionPartial fixture for cache-hit tests.
 *
 * @param {Partial<AssignmentDefinitionPartial>} overrides Fields to override.
 * @returns {AssignmentDefinitionPartial} A definition partial fixture.
 */
export function createDefinitionPartial(
  overrides: Partial<AssignmentDefinitionPartial> = {}
): AssignmentDefinitionPartial {
  return {
    primaryTitle: 'Essay',
    primaryTopic: 'Writing',
    primaryTopicKey: 'topic-writing',
    yearGroupKey: 'year-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-001',
    templateDocumentId: 'tpl-001',
    assignmentWeighting: null,
    definitionKey: 'essay-def-key',
    tasks: [],
    createdAt: DEFAULT_ISO_DATETIME,
    updatedAt: DEFAULT_ISO_DATETIME,
    ...overrides,
  };
}

/**
 * Creates an AssignmentDefinitionPartial fixture with sensible defaults.
 *
 * Only `primaryTitle`, `primaryTopic`, and `yearGroupKey` are varied per test;
 * all other fields are fixed to reduce noise.
 *
 * @param {Partial<AssignmentDefinitionPartial>} overrides Fields to override on the default fixture.
 * @returns {AssignmentDefinitionPartial} An AssignmentDefinitionPartial fixture.
 */
export function createFixture(
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
    tasks: [],
    createdAt: DEFAULT_ISO_DATETIME,
    updatedAt: DEFAULT_ISO_DATETIME,
    ...overrides,
  };
}

/**
 * Creates a selected assignment fixture with sensible defaults.
 *
 * Only fields that differ from the default `Essay` / `Writing` assignment
 * need to be provided, reducing noise in each test case.
 *
 * @param {Partial<{ assignmentId: string; title: string; topicName: string | null }>} [overrides={}] Fields to override on the default fixture.
 * @returns {{ assignmentId: string; title: string; topicName: string | null }} A selected assignment fixture.
 */
export function createSelectedAssignment(
  overrides: Partial<{ assignmentId: string; title: string; topicName: string | null }> = {}
): { assignmentId: string; title: string; topicName: string | null } {
  return { ...DEFAULT_SELECTED_ASSIGNMENT, ...overrides };
}

/**
 * Calls `findMatchingDefinition` with a single-element fixture array and
 * asserts the result is `matched` with that element.
 *
 * @param {Partial<AssignmentDefinitionPartial>} fixtureOverrides Overrides passed to `createFixture` for the single definition partial.
 * @param {Partial<{ assignmentId: string; title: string; topicName: string | null }>} [selectedAssignmentOverrides={}] Overrides passed to `createSelectedAssignment`.
 * @param {object} [classPartial] Class partial to pass; defaults to `DEFAULT_CLASS_PARTIAL`.
 * @param {string | null} [classPartial.yearGroupKey] The year group key.
 * @returns {void}
 */
export function expectMatchedWithFixture(
  fixtureOverrides: Partial<AssignmentDefinitionPartial>,
  selectedAssignmentOverrides: Partial<{
    assignmentId: string;
    title: string;
    topicName: string | null;
  }> = {},
  classPartial: { yearGroupKey: string | null } = DEFAULT_CLASS_PARTIAL
): void {
  const definitionPartials: AssignmentDefinitionPartial[] = [createFixture(fixtureOverrides)];

  const result = findMatchingDefinition(
    createSelectedAssignment(selectedAssignmentOverrides),
    classPartial,
    definitionPartials
  );

  expect(result.kind).toBe('matched');
  if (result.kind === 'matched') {
    expect(result.definition).toBe(definitionPartials[0]);
  }
}

/**
 * Calls `findMatchingDefinition` with a single-element fixture array and
 * asserts the result is `no-match` (the inverse of `expectMatchedWithFixture`).
 *
 * @param {Partial<AssignmentDefinitionPartial>} fixtureOverrides Overrides passed to `createFixture` for the single definition partial.
 * @param {Partial<{ assignmentId: string; title: string; topicName: string | null }>} [selectedAssignmentOverrides={}] Overrides passed to `createSelectedAssignment`.
 * @param {object} [classPartial] Class partial to pass; defaults to `DEFAULT_CLASS_PARTIAL`.
 * @param {string | null} [classPartial.yearGroupKey] The year group key.
 */
export function expectNoMatchWithFixture(
  fixtureOverrides: Partial<AssignmentDefinitionPartial>,
  selectedAssignmentOverrides: Partial<{
    assignmentId: string;
    title: string;
    topicName: string | null;
  }> = {},
  classPartial: { yearGroupKey: string | null } = DEFAULT_CLASS_PARTIAL
): void {
  const definitionPartials: AssignmentDefinitionPartial[] = [createFixture(fixtureOverrides)];

  const result = findMatchingDefinition(
    createSelectedAssignment(selectedAssignmentOverrides),
    classPartial,
    definitionPartials
  );

  expect(result.kind).toBe('no-match');
}
