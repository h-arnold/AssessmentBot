/**
 * Shared test fixtures for assignment definition testing.
 * Centralises mock data used across both unit tests and E2E tests.
 * Reduces duplication and ensures consistency across test suites.
 */

import type { AssignmentDefinition, AssignmentTopic, YearGroup } from '../../../services/referenceData.zod';

/**
 * Standard mock topics for testing.
 * Used in both unit tests and E2E tests.
 */
export const mockTopics: AssignmentTopic[] = [
  { key: 'topic-algebra', name: 'Algebra' },
  { key: 'topic-geometry', name: 'Geometry' },
] as const;

/**
 * Standard mock year groups for testing.
 * Used in both unit tests and E2E tests.
 */
export const mockYearGroups: YearGroup[] = [
  { key: 'year-group-10', name: 'Year 10' },
  { key: 'year-group-11', name: 'Year 11' },
] as const;

/**
 * Standard mock cohorts for testing.
 * Used in both unit tests and E2E tests.
 */
export const mockCohorts = [
  { key: 'cohort-2026', name: 'Cohort 2026', active: true },
  { key: 'cohort-2025', name: 'Cohort 2025', active: false },
] as const;

/**
 * Standard full assignment definition fixture for testing.
 * Represents a complete, persisted assignment definition with all required fields.
 * Used in both unit tests and E2E tests.
 */
export const mockFullAssignmentDefinition: AssignmentDefinition = {
  definitionKey: 'algebra-baseline',
  primaryTitle: 'Algebra Baseline',
  primaryTopicKey: 'topic-algebra',
  primaryTopic: 'Algebra',
  yearGroupKey: 'year-group-10',
  yearGroupLabel: 'Year 10',
  alternateTitles: [],
  alternateTopics: [],
  documentType: 'SLIDES',
  referenceDocumentId: 'ref-doc-123',
  templateDocumentId: 'tpl-doc-456',
  assignmentWeighting: 5,
  tasks: [
    { taskId: 'task-1', taskTitle: 'Solve quadratic equations', taskWeighting: 2 },
    { taskId: 'task-2', taskTitle: 'Simplify expressions', taskWeighting: 1 },
    { taskId: 'task-3', taskTitle: 'Factor polynomials', taskWeighting: 3 },
  ],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
} as const;

/**
 * Alias for E2E test compatibility.
 * @deprecated Use mockFullAssignmentDefinition instead.
 */
export const mockFullDefinition = mockFullAssignmentDefinition;
