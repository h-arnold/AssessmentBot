/**
 * Fixture and payload builders for the Task Heatmap browser journey.
 *
 * The fixture is intentionally local to this E2E surface. It mirrors the
 * relevant anon-test-data shape for class "7C2 Digital Technology 2025-2026"
 * while keeping the live assignment definition partial separate from the class
 * snapshot.
 *
 * The source JSON cannot be imported here because Vite's `server.fs.allow`
 * blocks the cross-root path from `src/frontend/e2e-tests` to
 * `tests/__mocks__/data/anon-test-data.json`. These builders therefore retain
 * the typed, plain-object journey payload locally.
 */

export const HEATMAP_CLASS_ID = '100000000001';
export const HEATMAP_ASSIGNMENT_NAME = '4. Presenting our Findings - Video Plan';
export const HEATMAP_ASSIGNMENT_DISPLAY_TITLE = '7. Video Plan';
export const HEATMAP_CLASS_NAME = '7C2 Digital Technology 2025-2026';

const HEATMAP_ASSIGNMENT_ID = '100000000037';
const HEATMAP_DEFINITION_KEY = '00000000-0000-0000-0000-000000000004';
const HEATMAP_TASK_IDS = ['task_001', 'task_002', 'task_003'] as const;

type HeatmapStudent = Readonly<{ id: string; name: string }>;
type HeatmapTaskMetric = {
  completeness: number | string;
  accuracy: number | string;
  spag: number | string;
};
type HeatmapStudentScores = Record<string, HeatmapTaskMetric>;

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
 * Build one submission item for the class snapshot.
 * @param {HeatmapStudent} student - Student owning the item.
 * @param {(typeof HEATMAP_TASK_IDS)[number]} taskId - Task identifier.
 * @param {boolean} empty - Whether to use not-attempted scores.
 * @returns {Record<string, unknown>} Submission item payload.
 */
function buildItem(
  student: HeatmapStudent,
  taskId: (typeof HEATMAP_TASK_IDS)[number],
  empty: boolean
) {
  const fallback = { completeness: 'N', accuracy: 'N', spag: 'N' };
  const metrics = empty ? fallback : (HEATMAP_SUBMISSION_SCORES[student.id]?.[taskId] ?? fallback);
  return {
    taskId,
    artifact: { taskId, role: 'submission', uid: `uid-${student.id}-${taskId}`, type: 'page' },
    assessments: {
      completeness: { score: metrics.completeness },
      accuracy: { score: metrics.accuracy },
      spag: { score: metrics.spag },
    },
    feedback: {},
    id: `ssi-${student.id}-${taskId}`,
  };
}

/**
 * Build the class snapshot returned by `getABClass`.
 *
 * The transport shape reflects the embedded-assignmentDefinition removal:
 * assignment details are resolved from the warm-up
 * `AssignmentDefinitionPartials` registry by `assignmentDefinitionKey`.
 * The class snapshot therefore deliberately carries the registry key rather
 * than an embedded definition object.
 * @param {boolean} emptySubmissions - Whether submissions should be empty.
 * @returns {Record<string, unknown>} Class payload.
 */
export function buildClassFullDocument(emptySubmissions: boolean): Record<string, unknown> {
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
      ...student,
      email: `${student.id}@example.com`,
    })),
    assignments: [
      {
        courseId: HEATMAP_CLASS_ID,
        assignmentId: HEATMAP_ASSIGNMENT_ID,
        assignmentName: HEATMAP_ASSIGNMENT_NAME,
        dueDate: null,
        updatedAt: '2026-07-07T07:51:13.282Z',
        createdAt: '2026-06-29T09:40:37.069Z',
        documentType: 'SLIDES',
        assignmentDefinitionKey: HEATMAP_DEFINITION_KEY,
        submissions: HEATMAP_STUDENTS.map((student) => ({
          studentId: student.id,
          assignmentId: HEATMAP_ASSIGNMENT_ID,
          documentId: `doc-${student.id}`,
          studentName: student.name,
          items: Object.fromEntries(
            HEATMAP_TASK_IDS.map((taskId) => [taskId, buildItem(student, taskId, emptySubmissions)])
          ),
          createdAt: '2026-07-07T07:49:23.014Z',
          updatedAt: '2026-07-07T07:49:29.872Z',
          _updateCounter: 0,
        })),
      },
    ],
    active: true,
  };
}

/**
 * Add a second assignment sharing the fixture definition.
 * @param {Record<string, unknown>} classDocument - Class payload to mutate.
 */
export function addSecondAssignment(classDocument: Record<string, unknown>): void {
  const assignments = classDocument.assignments as Array<Record<string, unknown>>;
  const firstAssignment = assignments[0];
  if (!firstAssignment) {
    throw new Error('Expected the heatmap fixture to contain an assignment.');
  }
  const secondAssignmentId = `${HEATMAP_ASSIGNMENT_ID}-2`;
  assignments.push({
    ...firstAssignment,
    assignmentId: secondAssignmentId,
    submissions: (firstAssignment.submissions as Array<Record<string, unknown>>).map(
      (submission) => ({
        ...submission,
        assignmentId: secondAssignmentId,
      })
    ),
  });
}

/**
 * Build the live definition partial used by analysis and heatmap columns.
 *
 * The partial is authoritative for assignment weighting, task weighting, and
 * task titles. Every task retains a `taskId`, a weighting, and a non-null
 * `taskTitle` so the heatmap adapter can build its columns; if the keyed
 * partial is unavailable, the adapter raises `TaskTitlesUnavailableError`.
 * The zero-weight option changes only `assignmentWeighting` in this live
 * partial, leaving the class and assignment snapshots unchanged.
 * @param {boolean} zeroTasks - Whether to omit task columns.
 * @param {boolean} zeroWeightAssignment - Whether assignment weighting is zero.
 * @returns {Record<string, unknown>} Definition partial payload.
 */
export function buildAssignmentDefinitionPartial(
  zeroTasks: boolean,
  zeroWeightAssignment: boolean
): Record<string, unknown> {
  return {
    primaryTitle: HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
    primaryTopic: 'Earth',
    primaryTopicKey: '00000000-0000-0000-0000-000000000003',
    yearGroupKey: '00000000-0000-0000-0000-000000000002',
    yearGroupLabel: '7',
    alternateTitles: [HEATMAP_ASSIGNMENT_NAME],
    alternateTopics: ['Earth'],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref',
    templateDocumentId: 'tpl',
    assignmentWeighting: zeroWeightAssignment ? 0 : 1,
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

const REASONING: Readonly<Record<string, string>> = {
  'task_001.completeness': 'Student included all required sections of the video plan.',
  'task_001.accuracy': 'Student labelled the equipment accurately and used correct terms.',
  'task_001.spag': 'Spelling and grammar were consistently correct throughout.',
  'task_002.completeness': 'Student explained the method clearly and showed all working.',
  'task_002.accuracy': 'Student explained the method clearly and showed all working.',
  'task_002.spag': 'Spelling and grammar were consistently correct throughout.',
  'task_003.completeness': 'Student laid out the table with all required columns.',
  'task_003.accuracy': 'Table values were accurate against the source data.',
  'task_003.spag': 'Table formatting and headings were consistent and clear.',
};

const ARTIFACT_CONTENT: Readonly<Record<string, string>> = {
  task_001:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  task_002: 'The student wrote a clear, step-by-step plan for the video.',
  task_003: '| Criteria | Met |\n| --- | --- |\n| Layout | Yes |\n| Accuracy | Yes |',
};

/**
 * Resolve the seeded reasoning text for one task criterion.
 * @param {string} taskId - Task identifier.
 * @param {string} metric - Criterion identifier.
 * @returns {string} Seeded reasoning text or the established fallback.
 */
function reasoningFor(taskId: string, metric: string): string {
  return (
    REASONING[`${taskId}.${metric}`] ?? 'Student completed the task to an acceptable standard.'
  );
}

/**
 * Build an artifact in the assignment preview payload.
 * @param {string} taskId - Task identifier.
 * @param {string} studentId - Student identifier.
 * @returns {Record<string, unknown>} Artifact payload.
 */
function buildArtifact(taskId: string, studentId: string): Record<string, unknown> {
  const artifactType = { task_001: 'IMAGE', task_002: 'TEXT', task_003: 'TABLE' }[taskId];

  return {
    taskId,
    role: 'submission',
    pageId: 'page-1',
    documentId: `doc-${studentId}`,
    uid: `uid-${studentId}-${taskId}`,
    contentHash: null,
    metadata: {},
    type: artifactType,
    content: ARTIFACT_CONTENT[taskId],
  };
}

/**
 * Build one item in the assignment preview payload.
 * @param {string} taskId - Task identifier.
 * @param {string} studentId - Student identifier.
 * @returns {Record<string, unknown>} Assignment item payload.
 */
function buildAssignmentItem(taskId: string, studentId: string) {
  return {
    id: `ssi-${studentId}-${taskId}`,
    taskId,
    artifact: buildArtifact(taskId, studentId),
    assessments: {
      completeness: { score: 5, reasoning: reasoningFor(taskId, 'completeness') },
      accuracy: { score: 4, reasoning: reasoningFor(taskId, 'accuracy') },
      spag: { score: 5, reasoning: reasoningFor(taskId, 'spag') },
    },
    feedback: {},
  };
}

/**
 * Build the assignment payload used by preview requests.
 *
 * This is the real-data `AssignmentFull` shape used by the preview flow rather
 * than a fixture adapter shortcut. The artifact content is intentionally
 * renderable so image and markdown preview assertions exercise their normal
 * renderers. Its embedded assignment definition is the full schema shape;
 * heatmap column sourcing remains owned by the live partial above.
 * @returns {Record<string, unknown>} Assignment payload.
 */
export function buildAssignmentFullDocument(): Record<string, unknown> {
  const studentId = '100000000005';
  return {
    courseId: HEATMAP_CLASS_ID,
    assignmentId: HEATMAP_ASSIGNMENT_ID,
    assignmentName: HEATMAP_ASSIGNMENT_NAME,
    dueDate: null,
    updatedAt: '2026-07-07T07:51:13.282Z',
    createdAt: '2026-06-29T09:40:37.069Z',
    documentType: 'SLIDES',
    referenceDocumentId: 'ref',
    templateDocumentId: 'tpl',
    tasks: {},
    submissions: [
      {
        studentId,
        studentName: 'Student Two',
        assignmentId: HEATMAP_ASSIGNMENT_ID,
        documentId: `doc-${studentId}`,
        items: Object.fromEntries(
          HEATMAP_TASK_IDS.map((taskId) => [taskId, buildAssignmentItem(taskId, studentId)])
        ),
        createdAt: '2026-07-07T07:49:23.014Z',
        updatedAt: '2026-07-07T07:49:29.872Z',
      },
    ],
    assignmentDefinition: {
      primaryTitle: HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
      primaryTopic: 'Earth',
      primaryTopicKey: '00000000-0000-0000-0000-000000000003',
      yearGroupKey: '00000000-0000-0000-0000-000000000002',
      yearGroupLabel: '7',
      alternateTitles: [HEATMAP_ASSIGNMENT_NAME],
      alternateTopics: ['Earth'],
      documentType: 'SLIDES',
      referenceDocumentId: 'ref',
      templateDocumentId: 'tpl',
      referenceLastModified: '2026-07-07T07:45:23.916Z',
      templateLastModified: '2026-07-07T07:45:23.916Z',
      assignmentWeighting: 1,
      definitionKey: HEATMAP_DEFINITION_KEY,
      tasks: {},
      createdAt: '2026-07-07T07:45:23.916Z',
      updatedAt: '2026-07-07T07:49:06.791Z',
    },
  };
}
