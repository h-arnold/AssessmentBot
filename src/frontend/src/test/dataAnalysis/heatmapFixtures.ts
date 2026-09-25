import { QueryClient } from '@tanstack/react-query';
import type { MergedHeatmapResult } from '../../services/dataAnalysis/heatmapAdapter.merged';
import { buildTaskKey } from '../../services/dataAnalysis/taskKey';
import type { AssignmentDefinitionPartial } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import { createAssignmentPartial, createDefinitionPartial, createTaskPartial } from './fixtures';

/**
 * Create an isolated QueryClient for frontend hook and page tests.
 *
 * @returns {QueryClient} A query client with retries disabled.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

/**
 * Build a minimal ClassFull fixture for heatmap page and hook tests.
 *
 * @param {Partial<ClassFull>} [overrides] - Optional class-field overrides.
 * @returns {ClassFull} A class fixture with one student and two assignments.
 */
export function createHeatmapClassFull(overrides: Partial<ClassFull> = {}): ClassFull {
  return {
    classId: 'class-abc-123',
    className: 'Test Class 7A',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'yg-7',
    classOwner: null,
    teachers: [],
    students: [{ id: 's-1', name: 'Student One', email: 's1@test.com' }],
    assignments: [
      {
        ...createAssignmentPartial({
          assignmentId: 'a1',
          definitionKey: 'def1',
          submissions: [],
        }),
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      {
        ...createAssignmentPartial({
          assignmentId: 'a2',
          definitionKey: 'def2',
          submissions: [],
        }),
        updatedAt: '2025-02-01T00:00:00.000Z',
      },
    ],
    active: true,
    ...overrides,
  };
}

/**
 * Build one live definition partial for a heatmap task column.
 *
 * @param {Object} options - Partial identity and task fields.
 * @param {string} options.definitionKey - The assignment-definition key.
 * @param {string} options.primaryTitle - The assignment title.
 * @param {string} options.taskId - The task identifier.
 * @param {string | null} [options.taskTitle] - The task title.
 * @param {number | null} [options.assignmentWeighting] - The live assignment weighting.
 * @returns {AssignmentDefinitionPartial} A schema-shaped definition partial.
 */
export function createHeatmapDefinitionPartial(options: {
  definitionKey: string;
  primaryTitle: string;
  taskId: string;
  taskTitle?: string | null;
  assignmentWeighting?: number | null;
}): AssignmentDefinitionPartial {
  return {
    ...createDefinitionPartial({
      definitionKey: options.definitionKey,
      assignmentWeighting: options.assignmentWeighting,
      tasks: [createTaskPartial(options.taskId, 1, options.taskTitle ?? null)],
    }),
    primaryTitle: options.primaryTitle,
  } as AssignmentDefinitionPartial;
}

/**
 * Build a minimal merged heatmap result for page-data and surface tests.
 *
 * @param {Partial<MergedHeatmapResult>} [overrides] - Optional result-field overrides.
 * @returns {MergedHeatmapResult} A schema-shaped merged heatmap fixture.
 */
export function createHeatmapMergedResult(
  overrides: Partial<MergedHeatmapResult> = {}
): MergedHeatmapResult {
  return {
    classId: 'class-abc-123',
    className: 'Test Class 7A',
    sourceAssignments: [
      { assignmentId: 'a1', definitionKey: 'def1', assignmentName: 'Title def1' },
    ],
    taskColumns: [
      {
        taskKey: buildTaskKey('def1', 'tA'),
        taskId: 'tA',
        taskTitle: 'Task A',
        averageContribution: { effectiveWeight: 1, includedInAverage: true },
        assignmentId: 'a1',
        definitionKey: 'def1',
        assignmentName: 'Title def1',
      },
    ],
    rows: [],
    ...overrides,
  };
}
