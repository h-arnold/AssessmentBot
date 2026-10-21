/**
 * Shared fixture setup for the `heatmapAdapter` suites.
 *
 * Owns the class/definition/class-full/averaging-result builders used by both
 * `heatmapAdapter.spec.ts` (warm-up partial sourcing) and
 * `heatmapAdapter.weighting.spec.ts` (live weighting projection), moved
 * verbatim from the original single spec file so both suites exercise
 * identical fixtures. Tests clone-or-build per call; no builder mutates a
 * shared record, and suites that intentionally mutate a freshly built fixture
 * (for example a live task weighting) own their own instance.
 */

import type { AveragingResult } from '@/services/dataAnalysis/dataAnalysis.zod';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentDefinitionPartialsResponse } from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { createComputedMetricResult, createTaskPartial } from './fixtures';
import { createCanonicalMetadataFixture } from '@/test/abClass/abClassMetadataFixtures';

export const CLASS_ID = 'class_001';
export const CLASS_NAME = 'Year 10 Mathematics';
export const ASSIGNMENT_ID = 'assignment_001';
export const DEFINITION_KEY = 'dk_quadratics';

const STUDENT_IDS = ['s_001', 's_002'];
const STUDENT_NAMES = ['Alice', 'Bob'];
const TASK_IDS = ['task_001', 'task_002', 'task_003'];

/**
 * Build a taskKey in the canonical `${definitionKey}::${taskId}` format.
 *
 * @param {string} taskId - The stable task identifier.
 * @returns {string} The canonical task-key string.
 */
export function taskKey(taskId: string): string {
  return `${DEFINITION_KEY}::${taskId}`;
}

/**
 * Build a student-summaries array from the shared STUDENT_IDS and STUDENT_NAMES constants.
 *
 * @returns {Array<{id: string, name: string, email: string}>} An array of student-summary objects.
 */
function buildStudentSummaries() {
  return STUDENT_IDS.map((id, index) => {
    return {
      id,
      name: STUDENT_NAMES[index],
      email: `${id}@school.edu`,
    };
  });
}

/**
 * Build a task-partials array from the shared TASK_IDS constant.
 *
 * @returns {Array<{taskId: string, taskWeighting: number, taskTitle: string | null}>} An array of task-partial objects.
 */
function buildTasks() {
  return TASK_IDS.map((id) => createTaskPartial(id, 1));
}

/**
 * Build a minimal AssignmentDefinitionPartial fixture for the test assignment.
 *
 * @returns {Object} An assignment-definition-partial-shaped object with a
 *   `primaryTitle` of "Quadratics Assessment" and tasks from {@link buildTasks}.
 */
function buildDefinition() {
  return {
    primaryTitle: 'Quadratics Assessment',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'algebra',
    yearGroupKey: 'yg-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [] as string[],
    alternateTopics: [] as string[],
    documentType: 'assignment',
    referenceDocumentId: null,
    templateDocumentId: null,
    assignmentWeighting: 1,
    definitionKey: DEFINITION_KEY,
    tasks: buildTasks(),
    createdAt: '2026-01-15T09:00:00.000Z',
    updatedAt: null,
  };
}

/**
 * Build a minimal AssignmentPartial fixture wrapping the test definition.
 *
 * @returns {Object} An assignment-partial-shaped object containing the
 *   assignment ID, document type, and the nested definition from
 *   {@link buildDefinition}.
 */
function buildAssignmentPartial() {
  return {
    assignmentId: ASSIGNMENT_ID,
    dueDate: null,
    updatedAt: null,
    createdAt: '2026-01-15T09:00:00.000Z',
    documentType: 'assessment',
    submissions: [],
    assignmentDefinitionKey: DEFINITION_KEY,
  };
}

/**
 * Build a minimal ClassFull fixture for the test class.
 *
 * @returns {ClassFull} A fully typed ClassFull fixture with the test class ID,
 *   name, student summaries, and one assignment.
 */
export function buildClassFull(): ClassFull {
  return {
    classId: CLASS_ID,
    className: CLASS_NAME,
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'yg-10',
    classOwner: null,
    teachers: [],
    students: buildStudentSummaries(),
    assignments: [buildAssignmentPartial()],
    active: null,
    metadata: createCanonicalMetadataFixture(),
  };
}

/**
 * Build a minimal AssignmentDefinitionPartialsResponse (array) containing a
 * single partial matching DEFINITION_KEY with titles set to the task id.
 *
 * @param {Partial<{taskTitle: string | null}>[]} [titleOverrides] - Optional per-task title overrides.
 * @returns {AssignmentDefinitionPartialsResponse} The partials array.
 */
export function buildPartials(
  titleOverrides?: Array<{ taskTitle?: string | null }>
): AssignmentDefinitionPartialsResponse {
  const titles = titleOverrides ?? TASK_IDS.map((id) => ({ taskTitle: id }));
  return [
    {
      ...buildDefinition(),
      tasks: TASK_IDS.map((id, index) => {
        return {
          taskId: id,
          taskWeighting: 1,
          taskTitle: titles[index]?.taskTitle ?? null,
        };
      }),
    },
  ] as AssignmentDefinitionPartialsResponse;
}

/**
 * Build part of the assignmentDefinitionPartials where the definitionKey does
 * NOT match DEFINITION_KEY (so getAssignmentDefinitionPartial returns null).
 *
 * @returns {AssignmentDefinitionPartialsResponse} A partials array with a non-matching partial.
 */
export function buildNonMatchingPartials(): AssignmentDefinitionPartialsResponse {
  return [
    {
      ...buildDefinition(),
      definitionKey: 'dk_other',
      tasks: [{ taskId: 't_other', taskWeighting: 1, taskTitle: 'Other Task' }],
    },
  ] as AssignmentDefinitionPartialsResponse;
}

/**
 * Build a PerStudentTaskMetric fixture for a given student and task.
 *
 * @param {string} studentId - The student identifier.
 * @param {string} taskId - The stable task identifier.
 * @returns {Object} A PerStudentTaskMetric-shaped object with sample computed
 *   metric results for all four criteria.
 */
export function buildPerStudentTaskMetric(studentId: string, taskId: string) {
  return {
    classId: CLASS_ID,
    studentId,
    taskKey: taskKey(taskId),
    averageContribution: { effectiveWeight: 1, includedInAverage: true },
    completeness: createComputedMetricResult({ value: 4 }),
    accuracy: createComputedMetricResult({ value: 3 }),
    spag: createComputedMetricResult({ value: 5 }),
    overall: createComputedMetricResult({ value: 4 }),
  };
}

/**
 * Build a minimal AveragingResult fixture with per-student-task metrics.
 *
 * @param {ReturnType<typeof buildPerStudentTaskMetric>[]} pstm - Array of
 *   per-student-task metric fixtures to include in the result.
 * @returns {AveragingResult} A structurally valid AveragingResult with default
 *   criterion weightings (40/40/20) and empty per-student/per-task arrays.
 */
export function minimalAveragingResult(
  pstm: ReturnType<typeof buildPerStudentTaskMetric>[]
): AveragingResult {
  return {
    classId: CLASS_ID,
    className: CLASS_NAME,
    perStudent: [],
    perTask: [],
    perClass: {
      completeness: createComputedMetricResult(),
      accuracy: createComputedMetricResult(),
      spag: createComputedMetricResult(),
      overall: createComputedMetricResult(),
    },
    appliedCriterionWeightings: { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
    perStudentTaskMetrics: pstm,
  };
}
