/**
 * Test-only helpers for the Task Heatmap Playwright E2E suite (ACTION_PLAN §6).
 *
 * Owns the `ClassFull` journey fixture derived from `tests/__mocks__/data/anon-test-data.json`
 * (a backend document-store snapshot) and the `createHeatmapScenario` runtime-scenario factory
 * that mirrors `createClassesScenario`.
 *
 * @see ACTION_PLAN.md §6 — Playwright E2E: full user journey
 * @see docs/developer/frontend/frontend-playwright-e2e.md — runtime mocks, StrictMode rule
 */

import type { ResponseItem, RuntimeScenario } from '../shared/endToEndRuntimeMocks';

// NOTE (deviation, ACTION_PLAN §6 Implementation notes):
// Vite's `server.fs.allow` blocks the cross-root import of
// `tests/__mocks__/data/anon-test-data.json` from within `src/frontend/e2e-tests`.
// Per the plan's documented fallback, the `ClassFull` journey fixture is co-located here
// as a typed literal seeded from the same anon mock data (class
// "7C2 Digital Technology 2025-2026", 10 students, one assignment with three
// submission tasks). The embedded `assignmentDefinition.tasks` is derived from the
// submission item keys (`task_001`/`task_002`/`task_003`) as
// `[{ taskId, taskWeighting: 1, taskTitle: 'Task 1' }, ...]` matching the `TaskPartial`
// shape (`taskPartial.zod.ts`, post-ACTION_PLAN §7b). The warm-up
// `getAssignmentDefinitionPartials` dataset is seeded separately (see
// `buildAssignmentDefinitionPartial`) because Section 8 sources the heatmap column
// set and titles from that warm-up partial, located by `definitionKey`.

/**
 * A single heatmap journey student (seeded from anon-test-data.json).
 */
type HeatmapStudent = Readonly<{
  id: string;
  name: string;
}>;

/** Class id for the heatmap journey fixture. */
export const HEATMAP_CLASS_ID = '100000000001';
const HEATMAP_ASSIGNMENT_ID = '100000000037';
const HEATMAP_DEFINITION_KEY = '00000000-0000-0000-0000-000000000004';
/** Class name used by the navigation assertions. */
export const HEATMAP_CLASS_NAME = '7C2 Digital Technology 2025-2026';
/**
 * Assignment `assignmentName` used only for anon-mock fidelity in the fixture.
 * The UI renders `primaryTitle`, NOT `assignmentName` (see `classPageAdapter.ts:330`).
 */
export const HEATMAP_ASSIGNMENT_NAME = '4. Presenting our Findings - Video Plan';
/** Assignment display title rendered in the UI (`primaryTitle`), used by card/header locators. */
export const HEATMAP_ASSIGNMENT_DISPLAY_TITLE = '7. Video Plan';

const HEATMAP_TASK_IDS = ['task_001', 'task_002', 'task_003'] as const;

/** The ten students seeded from the anon mock. */
const HEATMAP_STUDENTS: ReadonlyArray<HeatmapStudent> = [
  { id: '100000000004', name: 'Student One' },
  { id: '100000000005', name: 'Student Two' },
  { id: '100000000006', name: 'Student Three' },
  { id: '100000000007', name: 'Student Four' },
  { id: '100000000008', name: 'Student Five' },
  { id: '100000000009', name: 'Student Six' },
  { id: '100000000010', name: 'Student Seven' },
  { id: '100000000011', name: 'Student Eight' },
  { id: '100000000012', name: 'Student Nine' },
  { id: '100000000013', name: 'Student Ten' },
];

/**
 * Per-student task metric scores, seeded from anon-test-data.json.
 * Keyed by student id → task id → metric → score (`'N'` = not attempted).
 *
 * The anon fixture class has ~33 students; this E2E journey seeds the ten
 * students (Student One … Student Ten) exercised by the assertions.
 */
type HeatmapTaskMetric = {
  completeness: number | string;
  accuracy: number | string;
  spag: number | string;
};
type HeatmapStudentScores = Record<string, HeatmapTaskMetric>;
const HEATMAP_SUBMISSION_SCORES: Record<string, HeatmapStudentScores> = {
  '100000000004': {
    task_001: { completeness: 'N', accuracy: 'N', spag: 'N' },
    task_002: { completeness: 'N', accuracy: 'N', spag: 'N' },
    task_003: { completeness: 'N', accuracy: 'N', spag: 'N' },
  },
  '100000000005': {
    task_001: { completeness: 5, accuracy: 3, spag: 4 },
    task_002: { completeness: 5, accuracy: 4, spag: 4 },
    task_003: { completeness: 1, accuracy: 1, spag: 5 },
  },
  '100000000006': {
    task_001: { completeness: 5, accuracy: 3, spag: 4 },
    task_002: { completeness: 'N', accuracy: 'N', spag: 'N' },
    task_003: { completeness: 'N', accuracy: 'N', spag: 'N' },
  },
  '100000000007': {
    task_001: { completeness: 'N', accuracy: 'N', spag: 'N' },
    task_002: { completeness: 'N', accuracy: 'N', spag: 'N' },
    task_003: { completeness: 'N', accuracy: 'N', spag: 'N' },
  },
  '100000000008': {
    task_001: { completeness: 5, accuracy: 4, spag: 4 },
    task_002: { completeness: 3, accuracy: 3, spag: 3 },
    task_003: { completeness: 'N', accuracy: 'N', spag: 'N' },
  },
  '100000000009': {
    task_001: { completeness: 5, accuracy: 1, spag: 2 },
    task_002: { completeness: 3, accuracy: 4, spag: 4 },
    task_003: { completeness: 1, accuracy: 1, spag: 5 },
  },
  '100000000010': {
    task_001: { completeness: 4, accuracy: 3, spag: 2 },
    task_002: { completeness: 3, accuracy: 3, spag: 4 },
    task_003: { completeness: 1, accuracy: 1, spag: 4 },
  },
  '100000000011': {
    task_001: { completeness: 5, accuracy: 2, spag: 4 },
    task_002: { completeness: 5, accuracy: 4, spag: 3 },
    task_003: { completeness: 3, accuracy: 2, spag: 4 },
  },
  '100000000012': {
    task_001: { completeness: 3, accuracy: 2, spag: 2 },
    task_002: { completeness: 3, accuracy: 2, spag: 2 },
    task_003: { completeness: 'N', accuracy: 'N', spag: 'N' },
  },
  '100000000013': {
    task_001: { completeness: 4, accuracy: 2, spag: 2 },
    task_002: { completeness: 3, accuracy: 3, spag: 3 },
    task_003: { completeness: 0, accuracy: 0, spag: 0 },
  },
};

/**
 * Options for {@link createHeatmapScenario}.
 */
export interface CreateHeatmapScenarioOptions {
  /** When true, use a deferred (loading) `getABClass` queue. */
  deferredClass?: boolean;
  /** When true, build the empty-submissions fixture variant. */
  emptySubmissions?: boolean;
  /** When true, build the zero-tasks fixture variant. */
  zeroTasks?: boolean;
}

/**
 * Builds the `getABClass` success payload (a `ClassFull` document) for the
 * heatmap journey, seeded from the co-located anon data.
 *
 * @param {boolean} emptySubmissions Strip submissions (every cell not-attempted).
 * @returns {object} A plain `ClassFull` document.
 */
function buildClassFullDocument(emptySubmissions: boolean): Record<string, unknown> {
  return {
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
    students: HEATMAP_STUDENTS.map((student) => ({
      name: student.name,
      email: `${student.id}@example.com`,
      id: student.id,
    })),
    assignments: [
      {
        courseId: '100000000001',
        assignmentId: HEATMAP_ASSIGNMENT_ID,
        assignmentName: HEATMAP_ASSIGNMENT_NAME,
        dueDate: null,
        updatedAt: '2026-07-07T07:51:13.282Z',
        createdAt: '2026-06-29T09:40:37.069Z',
        documentType: 'SLIDES',
        // Transport shape after the embedded-assignmentDefinition removal
        // (commit 1472ed0): the frontend resolves definition details (primaryTitle,
        // tasks, etc.) from its own AssignmentDefinitionPartials registry keyed by
        // `assignmentDefinitionKey`. The full embedded object is no longer sent.
        assignmentDefinitionKey: HEATMAP_DEFINITION_KEY,
        submissions: HEATMAP_STUDENTS.map((student) => {
          const studentScores: HeatmapStudentScores = emptySubmissions
            ? {}
            : (HEATMAP_SUBMISSION_SCORES[student.id] ?? {});

          const buildItem = (
            taskId: (typeof HEATMAP_TASK_IDS)[number]
          ): Record<string, unknown> => {
            let taskMetrics: HeatmapTaskMetric | undefined;
            if (taskId === 'task_001') {
              taskMetrics = studentScores.task_001;
            } else if (taskId === 'task_002') {
              taskMetrics = studentScores.task_002;
            } else {
              taskMetrics = studentScores.task_003;
            }
            const metrics = taskMetrics ?? {
              completeness: 'N' as const,
              accuracy: 'N' as const,
              spag: 'N' as const,
            };
            return {
              taskId,
              artifact: {
                taskId,
                role: 'submission',
                uid: `uid-${student.id}-${taskId}`,
                type: 'page',
              },
              assessments: {
                completeness: { score: metrics.completeness },
                accuracy: { score: metrics.accuracy },
                spag: { score: metrics.spag },
              },
              feedback: {},
              id: `ssi-${student.id}-${taskId}`,
            };
          };

          const items: Record<string, unknown> = {
            task_001: buildItem('task_001'),
            task_002: buildItem('task_002'),
            task_003: buildItem('task_003'),
          };
          return {
            studentId: student.id,
            assignmentId: HEATMAP_ASSIGNMENT_ID,
            documentId: `doc-${student.id}`,
            studentName: student.name,
            items,
            createdAt: '2026-07-07T07:49:23.014Z',
            updatedAt: '2026-07-07T07:49:29.872Z',
            _updateCounter: 0,
          };
        }),
      },
    ],
    active: true,
  };
}

/**
 * Builds the warm-up `getAssignmentDefinitionPartials` payload for the heatmap
 * journey (ACTION_PLAN §8 / SPEC.md heatmap column sourcing).
 *
 * Section 8 sources the heatmap column set and per-task `taskTitle` from the
 * warm-up `assignmentDefinitionPartials` dataset, located by the assignment's
 * `definitionKey` via `getAssignmentDefinitionPartial`. The embedded
 * `classFull.assignments[].assignmentDefinition` is no longer the column source.
 * Each task must therefore carry `taskId`, `taskWeighting`, and a **non-null**
 * `taskTitle` matching the `TaskPartial` shape, or `adaptMetricsToHeatmap`
 * throws `TaskTitlesUnavailableError`.
 *
 * The partial mirrors the embedded assignment definition's fields (the strict
 * `AssignmentDefinitionPartialSchema` is enforced by `callApi`) and uses the
 * same `definitionKey` so the lookup resolves against the journey fixture.
 *
 * @param {boolean} zeroTasks Emit `tasks: []` (no task columns) for the zero-tasks variant.
 * @returns {Record<string, unknown>} A complete `AssignmentDefinitionPartial`.
 */
function buildAssignmentDefinitionPartial(zeroTasks: boolean): Record<string, unknown> {
  return {
    primaryTitle: '7. Video Plan',
    primaryTopic: 'Earth',
    primaryTopicKey: '00000000-0000-0000-0000-000000000003',
    yearGroupKey: '00000000-0000-0000-0000-000000000002',
    yearGroupLabel: '7',
    alternateTitles: [HEATMAP_ASSIGNMENT_NAME],
    alternateTopics: ['Earth'],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref',
    templateDocumentId: 'tpl',
    assignmentWeighting: 1,
    definitionKey: HEATMAP_DEFINITION_KEY,
    tasks: zeroTasks
      ? []
      : HEATMAP_TASK_IDS.map((taskId, index) => ({
          taskId,
          taskWeighting: 1,
          taskTitle: `Task ${index + 1}`,
        })),
    createdAt: '2026-07-07T07:45:23.916Z',
    updatedAt: '2026-07-07T07:49:06.791Z',
  };
}

/**
 * Creates a runtime scenario for the Task Heatmap E2E journey.
 *
 * Mirrors `createClassesScenario`: satisfies the warm-up `usePageDataset`
 * reference data (`getAuthorisationStatus`, `getABClassPartials`, `getCohorts`,
 * `getYearGroups`, `getAssignmentTopics`, `getAssignmentDefinitionPartials`) so
 * the ClassPage surface can reach `ready`, then adds `getABClass` — two
 * identical success entries for React 19 StrictMode double-effect (or two
 * `deferredSuccess` entries when `deferredClass` is set).
 *
 * @param {CreateHeatmapScenarioOptions} [options] Scenario customisation.
 * @returns {RuntimeScenario} The configured runtime scenario.
 */
export function createHeatmapScenario(options: CreateHeatmapScenarioOptions = {}): RuntimeScenario {
  const { deferredClass = false, emptySubmissions = false, zeroTasks = false } = options;

  const classDocument = buildClassFullDocument(emptySubmissions);

  const classEntries: ReadonlyArray<ResponseItem> = deferredClass
    ? [
        { kind: 'deferredSuccess', data: classDocument },
        { kind: 'deferredSuccess', data: classDocument },
      ]
    : [
        { kind: 'success', data: classDocument },
        { kind: 'success', data: classDocument },
      ];

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
      {
        kind: 'success',
        data: [{ key: '00000000-0000-0000-0000-000000000002', name: '7' }],
      },
      {
        kind: 'success',
        data: [{ key: '00000000-0000-0000-0000-000000000002', name: '7' }],
      },
    ],
    getAssignmentTopics: [{ kind: 'success', data: [] }],
    getAssignmentDefinitionPartials: [
      { kind: 'success', data: [buildAssignmentDefinitionPartial(zeroTasks)] },
    ],
    getABClass: classEntries,
  };
}
