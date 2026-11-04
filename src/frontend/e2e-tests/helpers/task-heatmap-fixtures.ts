/**
 * Fixture and payload builders for the Task Heatmap browser journey.
 *
 * The fixture is intentionally local to this E2E surface. It mirrors the
 * relevant anon-test-data shape for class "7C2 Digital Technology 2025-2026"
 * while keeping the live assignment definition partial separate from the class
 * snapshot.
 *
 * Realistic full-result source bodies and hashes are selected from the committed
 * canonical corpus; local identifiers and score/layout boundaries remain owned here.
 */

import assignmentsByKeyRaw from '@synthetic/small/assignmentsByKey.json';

export const HEATMAP_CLASS_ID = '100000000001';
export const HEATMAP_ASSIGNMENT_NAME = '4. Presenting our Findings - Video Plan';
export const HEATMAP_ASSIGNMENT_DISPLAY_TITLE = '7. Video Plan';
export const HEATMAP_CLASS_NAME = '7C2 Digital Technology 2025-2026';
/**
 * Google Classroom title for the fixture assignment after a teacher retitles it
 * post-assessment. The re-run journey asserts against this current title while
 * the run itself must reuse the definition key persisted on the class snapshot.
 */
export const HEATMAP_UPDATED_CLASSROOM_TITLE =
  '4. Presenting our Findings - Video Plan (edited in Classroom)';

export const HEATMAP_ASSIGNMENT_ID = '100000000037';
export const HEATMAP_DEFINITION_KEY = '00000000-0000-0000-0000-000000000004';
/** Task identifiers shared by the class snapshot builders and preview payloads. */
export const HEATMAP_TASK_IDS = ['task_001', 'task_002', 'task_003'] as const;

/**
 * Build the Google Classroom assignment listing for the fixture assignment.
 *
 * The listing keeps the class snapshot's assignment id but carries both a
 * retitled title and a renamed topic, so the explicit re-run journey proves the
 * persisted definition key survives a Classroom metadata change instead of
 * being re-matched by title or topic.
 *
 * @returns {Record<string, unknown>} Classroom assignment listing payload.
 */
export function buildGoogleClassroomAssignment(): Record<string, unknown> {
  return {
    assignmentId: HEATMAP_ASSIGNMENT_ID,
    title: HEATMAP_UPDATED_CLASSROOM_TITLE,
    creationTime: '2026-06-29T09:40:37.069Z',
    topicId: '00000000-0000-0000-0000-000000000009',
    topicName: 'Renamed Topic',
  };
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
 * @param {boolean} hasZeroTasks - Whether to omit task columns.
 * @param {boolean} isZeroWeightAssignment - Whether assignment weighting is zero.
 * @returns {Record<string, unknown>} Definition partial payload.
 */
export function buildAssignmentDefinitionPartial(
  hasZeroTasks: boolean,
  isZeroWeightAssignment: boolean
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
    assignmentWeighting: isZeroWeightAssignment ? 0 : 1,
    definitionKey: HEATMAP_DEFINITION_KEY,
    tasks: hasZeroTasks
      ? []
      : HEATMAP_TASK_IDS.map((taskId, index) => {
          return {
            taskId,
            taskWeighting: 1,
            taskTitle: `Task ${index + 1}`,
          };
        }),
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

type CanonicalSourceArtifact = {
  type: string;
  content: unknown;
  contentHash: string | null;
};
type CanonicalTask = Record<string, unknown> & { id: string };
const canonicalAssignments = assignmentsByKeyRaw as Record<
  string,
  {
    tasks: Record<string, CanonicalTask>;
    assignmentDefinition: { tasks: Record<string, CanonicalTask> };
    submissions: Array<{ items: Record<string, { artifact: CanonicalSourceArtifact }> }>;
  }
>;

/**
 * Find an actual usable body and paired source hash for a canonical artefact type.
 * @param {"TEXT" | "IMAGE" | "SPREADSHEET"} type - Canonical artefact type to select.
 * @returns {{ content: unknown; contentHash: string }} Paired body and source hash.
 */
function canonicalSource(type: 'TEXT' | 'IMAGE' | 'SPREADSHEET'): {
  content: unknown;
  contentHash: string;
} {
  for (const assignment of Object.values(canonicalAssignments)) {
    for (const submission of assignment.submissions) {
      for (const item of Object.values(submission.items)) {
        if (
          item.artifact.type === type &&
          item.artifact.content != null &&
          item.artifact.contentHash != null
        ) {
          return { content: item.artifact.content, contentHash: item.artifact.contentHash };
        }
      }
    }
  }
  throw new Error(`Canonical corpus has no usable ${type} submission source.`);
}

/**
 * Return canonical task records under this journey's local IDs. Compact
 * assignments contain two tasks; the existing three-task journey maps its
 * third local display boundary to the first canonical task record.
 * @returns {Record<string, CanonicalTask>} Canonical task projections.
 */
function canonicalHeatmapTasks(): Record<string, CanonicalTask> {
  const source = Object.values(canonicalAssignments).find(
    (assignment) => Object.keys(assignment.assignmentDefinition.tasks).length > 0
  );
  if (!source) throw new Error('Canonical corpus has no task records.');
  return Object.fromEntries(
    HEATMAP_TASK_IDS.map((taskId, index) => {
      const canonicalTasks = Object.values(source.assignmentDefinition.tasks);
      const task = canonicalTasks[index] ?? canonicalTasks[0];
      if (!task) throw new Error('Canonical task record is unavailable.');
      const artifacts = task.artifacts as
        | { reference?: Array<Record<string, unknown>>; template?: Array<Record<string, unknown>> }
        | undefined;
      return [
        taskId,
        {
          ...task,
          id: taskId,
          ...(artifacts && {
            artifacts: {
              ...artifacts,
              reference: artifacts.reference?.map((artifact) => ({ ...artifact, taskId })),
              template: artifacts.template?.map((artifact) => ({ ...artifact, taskId })),
            },
          }),
        },
      ];
    })
  );
}

/**
 * Narrow a fixture artefact type to one backed by the canonical corpus.
 * @param {string | undefined} type - Candidate fixture artefact type.
 * @returns {boolean} Whether the type has a canonical source.
 */
function isCanonicalSourceType(type: string | undefined): type is 'TEXT' | 'IMAGE' | 'SPREADSHEET' {
  return ['TEXT', 'IMAGE', 'SPREADSHEET'].includes(type ?? '');
}

/**
 * The deliberately local TABLE body used for renderer-boundary coverage.
 *
 * Exported so a new spec reuses the existing TABLE body rather than inventing
 * another local source. IMAGE and SPREADSHEET are canonical corpus capabilities.
 *
 * Kept alongside `ARTIFACT_CONTENT` on purpose: one source of truth for the
 * seeded bodies, no copy of the data URLs or markdown here.
 */
export const HEATMAP_UNSUPPORTED_ARTIFACT_CONTENT: Readonly<{
  readonly TABLE: string;
}> = Object.freeze({
  TABLE: ARTIFACT_CONTENT.task_003,
});

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
  let canonical: ReturnType<typeof canonicalSource> | null;
  if (artifactType === 'TABLE') {
    canonical = {
      content: ARTIFACT_CONTENT.task_003,
      // SHA-256 (Utils.generateHash) of the exact local Markdown body above.
      contentHash: 'b446679746be123af926fef8ca0f1b4956ce2a10d1d3ab0ef8adf4f30cfd8422',
    };
  } else {
    if (!isCanonicalSourceType(artifactType)) {
      throw new Error(`Heatmap fixture has no supported artefact type for ${taskId}.`);
    }
    canonical = canonicalSource(artifactType);
  }

  return {
    taskId,
    role: 'submission',
    pageId: 'page-1',
    documentId: `doc-${studentId}`,
    uid: `uid-${studentId}-${taskId}`,
    contentHash: canonical?.contentHash ?? null,
    metadata: {},
    type: artifactType,
    content: canonical?.content ?? ARTIFACT_CONTENT[taskId],
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
  const tasks = canonicalHeatmapTasks();
  return {
    assessmentContractVersion: 1,
    courseId: HEATMAP_CLASS_ID,
    assignmentId: HEATMAP_ASSIGNMENT_ID,
    assignmentName: HEATMAP_ASSIGNMENT_NAME,
    dueDate: null,
    updatedAt: '2026-07-07T07:51:13.282Z',
    createdAt: '2026-06-29T09:40:37.069Z',
    documentType: 'SLIDES',
    referenceDocumentId: 'ref',
    templateDocumentId: 'tpl',
    tasks,
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
      tasks,
      createdAt: '2026-07-07T07:45:23.916Z',
      updatedAt: '2026-07-07T07:49:06.791Z',
    },
  };
}
