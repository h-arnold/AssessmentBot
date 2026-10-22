/** Runtime scenario construction and shared navigation for the Task Heatmap suite. */

import { expect, type Page } from '@playwright/test';
import type { ResponseItem, RuntimeScenario } from '../shared/endToEndRuntimeMocks';
import { ABClassMetadataSchema } from '@/services/abClass/abClassMetadata.zod';
import { ClassFullSchema } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import {
  buildAssignmentDefinitionPartial,
  buildAssignmentFullDocument,
  buildGoogleClassroomAssignment,
  HEATMAP_CLASS_ID,
  HEATMAP_CLASS_NAME,
} from './task-heatmap-fixtures';
import { addSecondAssignment, buildClassFullDocument } from './task-heatmap-class-fixtures';

export {
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
  HEATMAP_ASSIGNMENT_ID,
  HEATMAP_CLASS_ID,
  HEATMAP_CLASS_NAME,
  HEATMAP_DEFINITION_KEY,
  HEATMAP_UPDATED_CLASSROOM_TITLE,
} from './task-heatmap-fixtures';

/** Shell menu label for the Classes entry in the application sidebar. */
export const CLASSES_LABEL = 'Classes';

export interface CreateHeatmapScenarioOptions {
  /** When true, use a deferred (loading) `getABClass` queue. */
  deferredClass?: boolean;
  /** When true, build the empty-submissions fixture variant. */
  emptySubmissions?: boolean;
  /** When true, build the zero-tasks fixture variant. */
  zeroTasks?: boolean;
  /** When true, include a second assignment sharing the fixture definition. */
  multipleAssignments?: boolean;
  /** When true, selecting the fixture class returns a retryable query failure. */
  classFailure?: boolean;
  /** When true, set only the live assignment-definition weighting to zero. */
  zeroWeightAssignment?: boolean;
}

/**
 * Apply a canonical numeric metadata snapshot matching the fixture's newest assignment version.
 * @param {Record<string, unknown>} classDocument - Mutable class response fixture.
 */
function applyEqualVersionMetadataBoundary(classDocument: Record<string, unknown>): void {
  const parsedClass = ClassFullSchema.parse(classDocument);
  const sourceMetadata = ABClassMetadataSchema.parse(parsedClass.metadata);
  if (sourceMetadata === null) return;

  const assignments = parsedClass.assignments.filter(
    (assignment): assignment is typeof assignment & { assignmentId: string; updatedAt: string } =>
      Boolean(assignment.assignmentId && assignment.updatedAt)
  );
  if (assignments.length !== parsedClass.assignments.length) {
    throw new Error('Task Heatmap fixture assignments must include assignmentId and updatedAt.');
  }
  const [newestAssignment] = assignments.toSorted((left, right) => {
    return (
      right.updatedAt.localeCompare(left.updatedAt) ||
      right.assignmentId.localeCompare(left.assignmentId)
    );
  });

  if (!newestAssignment) throw new Error('Task Heatmap fixture must include an assignment.');

  const existingRecent = sourceMetadata.recentAssignments[0];
  classDocument.metadata = ABClassMetadataSchema.parse({
    classAverages: sourceMetadata.classAverages,
    recentAssignments: [
      {
        assignmentId: newestAssignment.assignmentId,
        assignmentDefinitionKey: newestAssignment.assignmentDefinitionKey,
        updatedAt: newestAssignment.updatedAt,
        averages: existingRecent?.averages ?? {
          completeness: sourceMetadata.classAverages.completeness,
          accuracy: sourceMetadata.classAverages.accuracy,
          spag: sourceMetadata.classAverages.spag,
          overall: sourceMetadata.classAverages.overall,
        },
      },
    ],
  });
}

/**
 * Create a StrictMode-safe class response queue for the requested state.
 * @param {Record<string, unknown>} classDocument - Class payload.
 * @param {Pick<CreateHeatmapScenarioOptions, 'classFailure' | 'deferredClass'>} options - Queue state.
 * @returns {ReadonlyArray<ResponseItem>} Response queue.
 */
function createClassEntries(
  classDocument: Record<string, unknown>,
  options: Pick<CreateHeatmapScenarioOptions, 'classFailure' | 'deferredClass'>
): ReadonlyArray<ResponseItem> {
  // React 19 StrictMode replays the class-loading effect. Every response
  // variant therefore has two identical entries so the queue remains faithful
  // to both the initial call and its development replay.
  if (options.classFailure) {
    return [
      { kind: 'failureEnvelope', code: 'INTERNAL_ERROR', message: 'Class load failed' },
      { kind: 'failureEnvelope', code: 'INTERNAL_ERROR', message: 'Class load failed' },
    ];
  }
  if (options.deferredClass) {
    return [
      { kind: 'deferredSuccess', data: classDocument },
      { kind: 'deferredSuccess', data: classDocument },
    ];
  }
  return [
    { kind: 'success', data: classDocument },
    { kind: 'success', data: classDocument },
  ];
}

/**
 * Build the scenario with StrictMode-safe warm-up and class queues.
 * @param {CreateHeatmapScenarioOptions} options - Scenario customisation.
 * @returns {RuntimeScenario} Runtime mock scenario.
 */
export function createHeatmapScenario(options: CreateHeatmapScenarioOptions = {}): RuntimeScenario {
  const scenarioOptions = {
    deferredClass: false,
    emptySubmissions: false,
    zeroTasks: false,
    multipleAssignments: false,
    classFailure: false,
    zeroWeightAssignment: false,
    ...options,
  };

  const classDocument = buildClassFullDocument(scenarioOptions.emptySubmissions ?? false);
  if (scenarioOptions.multipleAssignments) addSecondAssignment(classDocument);

  // Hold this fixture's metadata version equal to its class document; it is not an analysis oracle.
  applyEqualVersionMetadataBoundary(classDocument);

  const classEntries = createClassEntries(classDocument, scenarioOptions);
  const partial = buildAssignmentDefinitionPartial(
    scenarioOptions.zeroTasks,
    scenarioOptions.zeroWeightAssignment
  );

  return {
    hasScriptAuthorisation: [{ kind: 'success', data: true }],
    getABClassPartials: [
      {
        kind: 'success',
        data: [
          {
            classId: HEATMAP_CLASS_ID,
            className: HEATMAP_CLASS_NAME,
            cohortKey: '00000000-0000-0000-0000-000000000001',
            courseLength: 1,
            yearGroupKey: '00000000-0000-0000-0000-000000000002',
            classOwner: {
              userId: '100000000002',
              email: 'teacher1@example.com',
              teacherName: 'Teacher A',
            },
            teachers: [],
            active: true,
            metadata: ClassFullSchema.parse(classDocument).metadata,
          },
        ],
      },
    ],
    getCohorts: [{ kind: 'success', data: [] }],
    getYearGroups: [
      { kind: 'success', data: [{ key: '00000000-0000-0000-0000-000000000002', name: '7' }] },
      { kind: 'success', data: [{ key: '00000000-0000-0000-0000-000000000002', name: '7' }] },
    ],
    getAssignmentTopics: [{ kind: 'success', data: [] }],
    getAssignmentDefinitionPartials: [{ kind: 'success', data: [partial] }],
    // React 19 StrictMode replays the assignment-loading effect. Keep two
    // identical entries so the warm-up queue is not exhausted by that replay.
    getAssignment: [
      { kind: 'success', data: buildAssignmentFullDocument() },
      { kind: 'success', data: buildAssignmentFullDocument() },
    ],
    getABClass: classEntries,
  };
}

/**
 * Navigate from the root shell to the heatmap class overview (ready state).
 *
 * @param {Page} page - The Playwright page.
 * @returns {Promise<void>} Resolves once the Recent Assignments section is visible.
 */
export async function openHeatmapClass(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

  // The class appears under a year-group panel; click its "View" button.
  const classCard = page.getByRole('article').filter({ hasText: HEATMAP_CLASS_NAME });
  await expect(classCard).toBeVisible();
  await classCard.getByRole('button', { name: 'View' }).click();

  // Wait for the ready-state Recent Assignments section (an antd Card title div).
  await expect(page.getByText('Recent Assignments')).toBeVisible();
}

export interface CreateReRunHeatmapScenarioOptions {
  /** StrictMode-safe `startAssessmentRun` queue for the automatic re-run. */
  startAssessmentRun: ReadonlyArray<ResponseItem>;
}

/**
 * Build the heatmap scenario for the explicit re-run journey.
 *
 * The Classroom listing keeps the fixture assignment id while carrying a
 * retitled title and a renamed topic, so the journey proves the run reuses the
 * definition key persisted on the class snapshot rather than re-matching the
 * current Classroom metadata.
 *
 * @param {CreateReRunHeatmapScenarioOptions} options - Scenario customisation.
 * @returns {RuntimeScenario} Runtime mock scenario.
 */
export function createReRunHeatmapScenario(
  options: CreateReRunHeatmapScenarioOptions
): RuntimeScenario {
  const classroomAssignment = buildGoogleClassroomAssignment();
  return {
    ...createHeatmapScenario(),
    // React 19 StrictMode replays the modal's assignment-fetch effect, so the
    // listing carries two identical entries like every other per-open queue.
    getGoogleClassroomAssignments: [
      { kind: 'success', data: [classroomAssignment] },
      { kind: 'success', data: [classroomAssignment] },
    ],
    startAssessmentRun: options.startAssessmentRun,
  };
}
