import type { AssignmentDefinition } from '../../services/assignmentDefinition.zod';
import type { AssignmentTopic } from '../../services/referenceData.zod';
import type { YearGroup } from '../../services/referenceData.zod';

/**
 * Assignment definition test fixtures module.
 *
 * Provides shared mock data and factory functions for assignment definition tests.
 * Use these helpers to reduce duplication across test files.
 */

// Import and re-export shared fixtures from central module
import { mockTopics, mockYearGroups, mockFullAssignmentDefinition } from './sharedTestFixtures';

// ============================================================================
// Topic Fixtures
// ============================================================================

/**
 * Standard mock topics for testing.
 */

/**
 * Creates mock topics with optional overrides.
 *
 * @param {Partial<AssignmentTopic>[]} overrides Array of partial topic overrides.
 * @returns {AssignmentTopic[]} Array of mock topics.
 */
export function createMockTopics(overrides: Partial<AssignmentTopic>[] = []): AssignmentTopic[] {
  return [
    ...mockTopics,
    ...overrides.map((override, index) => ({
      key: `topic-custom-${index}`,
      name: `Custom Topic ${index}`,
      yearGroupKeys: [],
      ...override,
    })),
  ];
}

// ============================================================================
// Year Group Fixtures
// ============================================================================

/**
 * Standard mock year groups for testing.
 */

/**
 * Creates mock year groups with optional overrides.
 *
 * @param {Partial<YearGroup>[]} overrides Array of partial year group overrides.
 * @returns {YearGroup[]} Array of mock year groups.
 */
export function createMockYearGroups(overrides: Partial<YearGroup>[] = []): YearGroup[] {
  return [
    ...mockYearGroups,
    ...overrides.map((override, index) => ({
      key: `year-group-custom-${index}`,
      name: `Custom Year ${index}`,
      ...override,
    })),
  ];
}

// ============================================================================
// Assignment Definition Fixtures
// ============================================================================

/**
 * Standard full assignment definition fixture for testing.
 * Represents a complete, persisted assignment definition with all required fields.
 */

/**
 * Standard upsert response fixture for testing.
 * Represents a typical response from upsertAssignmentDefinition.
 */
export const mockUpsertResponse: AssignmentDefinition = {
  definitionKey: 'test-key',
  primaryTitle: 'Test Assessment',
  primaryTopicKey: 'topic-algebra',
  primaryTopic: 'Algebra',
  yearGroupKey: 'year-group-10',
  yearGroupLabel: 'Year 10',
  alternateTitles: [],
  alternateTopics: [],
  documentType: 'SLIDES',
  referenceDocumentId: 'test-ref-id',
  templateDocumentId: 'test-tpl-id',
  assignmentWeighting: 1,
  tasks: [
    { taskId: 'task-1', taskTitle: 'Test Task 1', taskWeighting: 1 },
    { taskId: 'task-2', taskTitle: 'Test Task 2', taskWeighting: 1 },
  ],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
} as const;

/**
 * Minimal assignment definition fixture for testing.
 * Contains only required fields, useful for testing validation.
 */
export const mockMinimalAssignmentDefinition: Partial<AssignmentDefinition> = {
  primaryTitle: 'Minimal Assessment',
  primaryTopicKey: 'topic-algebra',
  yearGroupKey: 'year-group-10',
  referenceDocumentId: 'min-ref',
  templateDocumentId: 'min-tpl',
} as const;

/**
 * Creates a mock assignment definition with optional overrides.
 *
 * @param {Partial<AssignmentDefinition>} overrides Partial assignment definition to merge.
 * @returns {AssignmentDefinition} Complete mock assignment definition.
 */
export function createMockAssignmentDefinition(
  overrides: Partial<AssignmentDefinition> = {}
): AssignmentDefinition {
  return {
    ...mockFullAssignmentDefinition,
    ...overrides,
    // Ensure definitionKey is unique if provided
    definitionKey: overrides.definitionKey ?? `test-def-${Date.now()}`,
  };
}

/**
 * Creates a mock upsert response with optional overrides.
 *
 * @param {Partial<AssignmentDefinition>} overrides Partial assignment definition to merge.
 * @returns {AssignmentDefinition} Complete mock upsert response.
 */
export function createMockUpsertResponse(
  overrides: Partial<AssignmentDefinition> = {}
): AssignmentDefinition {
  return {
    ...mockUpsertResponse,
    ...overrides,
    // Ensure definitionKey is unique if provided
    definitionKey: overrides.definitionKey ?? `upsert-test-${Date.now()}`,
  };
}

/**
 * Creates a minimal assignment partial row for table/list testing.
 * These are the fields returned by getAssignmentDefinitionPartials.
 */
export type AssignmentDefinitionPartialRow = Pick<
  AssignmentDefinition,
  | 'definitionKey'
  | 'primaryTitle'
  | 'primaryTopicKey'
  | 'primaryTopic'
  | 'yearGroupKey'
  | 'yearGroupLabel'
  | 'alternateTitles'
  | 'alternateTopics'
  | 'documentType'
  | 'referenceDocumentId'
  | 'templateDocumentId'
  | 'assignmentWeighting'
  | 'tasks'
  | 'createdAt'
  | 'updatedAt'
>;

/**
 * Standard ready rows for assignment definition partials table testing.
 */
export const readyAssignmentPartialRows: AssignmentDefinitionPartialRow[] = [
  {
    primaryTitle: 'Algebra foundations',
    primaryTopicKey: 'topic-algebra',
    primaryTopic: 'Algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-1',
    templateDocumentId: 'tpl-1',
    assignmentWeighting: 20,
    definitionKey: 'alg-10-safe',
    tasks: [],
    createdAt: '2025-01-15T08:00:00.000Z',
    updatedAt: '2025-01-16T08:00:00.000Z',
  },
  {
    primaryTitle: 'Unsafe legacy row',
    primaryTopicKey: 'topic-legacy',
    primaryTopic: 'Legacy',
    yearGroupKey: 'year-group-unknown',
    yearGroupLabel: '—',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SHEETS',
    referenceDocumentId: 'ref-2',
    templateDocumentId: 'tpl-2',
    assignmentWeighting: 1,
    definitionKey: 'legacy/unsafe-key',
    tasks: [],
    createdAt: '2025-01-16T08:00:00.000Z',
    updatedAt: null,
  },
] as const;

/**
 * Creates a mock assignment partial row with optional overrides.
 *
 * @param {Partial<AssignmentDefinitionPartialRow>} overrides Partial row to merge.
 * @returns {AssignmentDefinitionPartialRow} Complete mock partial row.
 */
export function createMockAssignmentPartialRow(
  overrides: Partial<AssignmentDefinitionPartialRow> = {}
): AssignmentDefinitionPartialRow {
  return {
    ...readyAssignmentPartialRows[0],
    ...overrides,
    definitionKey: overrides.definitionKey ?? `partial-test-${Date.now()}`,
  };
}

// ============================================================================
// Cohort Fixtures
// ============================================================================

/**
 * Standard mock cohorts for testing.
 */

/**
 * Empty cohorts array for testing empty state.
 */
export const emptyCohorts: Array<{ key: string; name: string; active: boolean }> = [];

export {
  mockCohorts,
  mockTopics,
  mockYearGroups,
  mockFullAssignmentDefinition,
} from './sharedTestFixtures';
