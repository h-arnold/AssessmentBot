/** Runtime scenario construction for the Task Heatmap Playwright suite. */

import type { ResponseItem, RuntimeScenario } from '../shared/endToEndRuntimeMocks';
import {
  addSecondAssignment,
  buildAssignmentDefinitionPartial,
  buildAssignmentFullDocument,
  buildClassFullDocument,
  HEATMAP_CLASS_ID,
  HEATMAP_CLASS_NAME,
} from './task-heatmap-fixtures';

export {
  HEATMAP_ASSIGNMENT_NAME,
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
  HEATMAP_CLASS_ID,
  HEATMAP_CLASS_NAME,
} from './task-heatmap-fixtures';

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
  const scenarioOptions = Object.assign(
    {
      deferredClass: false,
      emptySubmissions: false,
      zeroTasks: false,
      multipleAssignments: false,
      classFailure: false,
      zeroWeightAssignment: false,
    },
    options
  );

  const classDocument = buildClassFullDocument(scenarioOptions.emptySubmissions);
  if (scenarioOptions.multipleAssignments) addSecondAssignment(classDocument);

  const classEntries = createClassEntries(classDocument, scenarioOptions);
  const partial = buildAssignmentDefinitionPartial(
    scenarioOptions.zeroTasks,
    scenarioOptions.zeroWeightAssignment
  );

  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
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
