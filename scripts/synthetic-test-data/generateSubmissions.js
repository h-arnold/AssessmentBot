import { isoAt, toImageDataUrl } from './deterministicPrimitives.js';

const CRITERIA = ['completeness', 'accuracy', 'spag'];
const ARTEFACT_BODY_TYPES = ['TEXT', 'IMAGE', 'SPREADSHEET'];
const ASSESSMENT_FAILED_REASONING = 'The extracted work could not be assessed.';
const SOURCE_UNREADABLE_REASONING = 'The submitted document could not be accessed.';
const STUDENT_INDEX_WITH_NULL_DOCUMENT = 2;
const STUDENT_INDEX_WITH_NULL_ARTIFACT_IDS = 3;
const STUDENT_INDEX_WITH_FAILED_ASSESSMENTS = 1;
const STUDENT_INDEX_WITH_NON_APPLICABLE_SPAG = 0;
const MAX_NUMERIC_SCORE = 5;
const MINUTES_BETWEEN_SUBMISSION_UPDATES = 5;
const MINUTES_PER_ASSIGNMENT = 60;
const MINUTES_PER_STUDENT = 7;

/**
 * Builds one terminal assessment entry.
 *
 * @param {number|'E'} score Entry score (0-5, 'N', or 'E').
 * @param {string} reasoning Entry reasoning.
 * @param {{stage: string, code: string}|null} error Error cause for failed entries.
 * @returns {{score: number|'E', reasoning: string, error?: {stage: string, code: string}}} Assessment entry.
 */
function buildAssessmentEntry(score, reasoning, error) {
  const entry = { score, reasoning };
  if (error !== null) entry.error = error;
  return entry;
}

/**
 * Builds the full all-three-criteria terminal failure map.
 *
 * @param {{stage: string, code: string}} error Error cause carried by every entry.
 * @param {string} reasoning Exact failure reasoning copied through every entry.
 * @returns {Record<string, object>} Assessment entries keyed by criterion.
 */
function buildFailureAssessments(error, reasoning) {
  return Object.fromEntries(
    CRITERIA.map((criterion) => [criterion, buildAssessmentEntry('E', reasoning, error)])
  );
}

/**
 * Builds the assessment map for a synthetic submission item.
 *
 * @param {number} studentIndex Roster index of the student.
 * @returns {Record<string, {score: number|'N'|'E', reasoning: string, error?: object}>} Assessment entries keyed by criterion.
 */
function buildAssessments(studentIndex) {
  if (studentIndex === STUDENT_INDEX_WITH_FAILED_ASSESSMENTS) {
    return buildFailureAssessments(
      { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
      ASSESSMENT_FAILED_REASONING
    );
  }
  const numericScore = studentIndex % (MAX_NUMERIC_SCORE + 1);
  const spagScore = studentIndex === STUDENT_INDEX_WITH_NON_APPLICABLE_SPAG ? 'N' : numericScore;
  return {
    completeness: {
      score: numericScore,
      reasoning: `Synthetic completeness rationale for student index ${studentIndex}.`,
    },
    accuracy: {
      score: numericScore,
      reasoning: `Synthetic accuracy rationale for student index ${studentIndex}.`,
    },
    spag: {
      score: spagScore,
      reasoning: `Synthetic SPaG rationale for student index ${studentIndex}.`,
    },
  };
}

/**
 * Builds the feedback map for a synthetic submission item.
 *
 * @param {number} studentIndex Roster index of the student.
 * @param {number} createdMinuteOffset Deterministic created-at offset.
 * @returns {Record<string, {type: string, createdAt: string}>} Feedback entries keyed by type.
 */
function buildFeedback(studentIndex, createdMinuteOffset) {
  if (studentIndex !== STUDENT_INDEX_WITH_NON_APPLICABLE_SPAG) {
    return {};
  }
  return {
    cellReference: {
      type: 'cellReference',
      createdAt: isoAt(createdMinuteOffset + 1),
    },
  };
}

/**
 * Builds the raw body for one generated artefact type.
 *
 * @param {string} type Artefact type (`TEXT`, `IMAGE`, or `SPREADSHEET`).
 * @param {string} bodyText Deterministic plain-text body seed.
 * @returns {string|Array<Array<string|number|null>>} Usable raw body for the type.
 */
function buildArtefactBody(type, bodyText) {
  if (type === 'IMAGE') return toImageDataUrl(bodyText);
  if (type === 'SPREADSHEET') {
    return [
      [bodyText, 1],
      [null, `${bodyText} (B2)`],
    ];
  }
  return bodyText;
}

/**
 * Builds the task artifact of one submission item.
 *
 * @param {object} options Artefact inputs.
 * @param {string} options.taskId Declared task ID.
 * @param {string} options.identifierSuffix Deterministic identity suffix.
 * @param {string} options.bodyText Deterministic plain-text body seed.
 * @param {string} options.artifactType Cycle-selected body type.
 * @param {boolean} options.isNullDocument Whether the artefact is the canonical base artefact.
 * @param {boolean} options.hasNullableArtifactIds Whether this partial-only item omits its persisted artifact IDs.
 * @returns {object} A persistence-shaped submission artefact.
 */
function buildSubmissionArtefact({
  taskId,
  identifierSuffix,
  bodyText,
  artifactType,
  isNullDocument,
  hasNullableArtifactIds,
}) {
  if (isNullDocument) {
    return {
      taskId,
      role: 'submission',
      pageId: null,
      documentId: null,
      content: null,
      contentHash: null,
      metadata: {},
      uid: `uid-${identifierSuffix}`,
      type: 'base',
    };
  }
  return {
    taskId,
    role: 'submission',
    pageId: hasNullableArtifactIds ? null : `page-${taskId}`,
    documentId: hasNullableArtifactIds ? null : `artifact-document-${identifierSuffix}`,
    content: buildArtefactBody(artifactType, bodyText),
    contentHash: `hash-${identifierSuffix}`,
    metadata: {},
    uid: `uid-${identifierSuffix}`,
    type: artifactType,
  };
}

/**
 * Builds one submission item, including its task artifact.
 *
 * @param {object} options Item inputs.
 * @param {string} options.assignmentId Parent assignment ID.
 * @param {string} options.studentId Roster student ID.
 * @param {number} options.studentIndex Roster index of the student.
 * @param {string} options.taskId Declared task ID.
 * @param {number} options.createdMinuteOffset Deterministic created-at offset.
 * @param {boolean} options.hasNullableArtifactIds Whether this partial-only item omits its persisted artifact IDs.
 * @param {string} options.artifactType Cycle-selected body type; the null-document variant always uses a base artefact.
 * @returns {object} A full persistence-shaped submission item.
 */
function buildSubmissionItem({
  assignmentId,
  studentId,
  studentIndex,
  taskId,
  createdMinuteOffset,
  hasNullableArtifactIds,
  artifactType,
}) {
  const identifierSuffix = `${assignmentId}-${studentId}-${taskId}`;
  const isNullDocument = studentIndex === STUDENT_INDEX_WITH_NULL_DOCUMENT;
  const bodyText = `Synthetic submission content for ${identifierSuffix}`;

  return {
    id: `ssi-${identifierSuffix}`,
    taskId,
    artifact: buildSubmissionArtefact({
      taskId,
      identifierSuffix,
      bodyText,
      artifactType,
      isNullDocument,
      hasNullableArtifactIds,
    }),
    assessments: isNullDocument
      ? buildFailureAssessments(
          { stage: 'acquisition', code: 'SOURCE_UNREADABLE' },
          SOURCE_UNREADABLE_REASONING
        )
      : buildAssessments(studentIndex),
    feedback: buildFeedback(studentIndex, createdMinuteOffset),
  };
}

/**
 * Builds the keyed submission items for one submission record.
 *
 * @param {object} options Item inputs.
 * @param {boolean} options.isPartialOnlyDefinition Whether the definition uses the partial task array form.
 * @param {string} options.assignmentId Parent assignment ID.
 * @param {{id: string}} options.student Roster student.
 * @param {number} options.studentIndex Roster index of the student.
 * @param {number} options.createdMinuteOffset Deterministic created-at offset.
 * @param {Array<string>} options.taskIds Declared task IDs.
 * @returns {Record<string, object>} Keyed submission items.
 */
function buildSubmissionItems({
  isPartialOnlyDefinition,
  assignmentId,
  student,
  studentIndex,
  createdMinuteOffset,
  taskIds,
}) {
  return Object.fromEntries(
    taskIds.map((taskId, taskPosition) => [
      taskId,
      buildSubmissionItem({
        assignmentId,
        studentId: student.id,
        studentIndex,
        taskId,
        createdMinuteOffset,
        hasNullableArtifactIds:
          isPartialOnlyDefinition && studentIndex === STUDENT_INDEX_WITH_NULL_ARTIFACT_IDS,
        artifactType:
          ARTEFACT_BODY_TYPES[(taskPosition + studentIndex) % ARTEFACT_BODY_TYPES.length],
      }),
    ])
  );
}

/**
 * Builds one persistence-shaped submission record for a roster student.
 *
 * @param {object} options Submission inputs.
 * @param {boolean} options.isPartialOnlyDefinition Whether the definition uses the partial task array form.
 * @param {string} options.assignmentId Parent assignment ID.
 * @param {{id: string, name: string}} options.student Roster student.
 * @param {number} options.studentIndex Roster index of the student.
 * @param {number} options.createdMinuteOffset Deterministic created-at offset.
 * @param {Record<string, object>} options.items Keyed submission items.
 * @returns {object} Full persistence-shaped submission.
 */
function buildSubmissionRecord({
  isPartialOnlyDefinition,
  assignmentId,
  student,
  studentIndex,
  createdMinuteOffset,
  items,
}) {
  const hasNullDocument = studentIndex === STUDENT_INDEX_WITH_NULL_DOCUMENT;
  return {
    studentId: student.id,
    studentName: isPartialOnlyDefinition && hasNullDocument ? null : student.name,
    assignmentId,
    documentId: hasNullDocument ? null : `submission-document-${assignmentId}-${student.id}`,
    items,
    createdAt: isoAt(createdMinuteOffset),
    updatedAt: isoAt(createdMinuteOffset + MINUTES_BETWEEN_SUBMISSION_UPDATES),
  };
}

/**
 * Resolves the declared task IDs from a keyed or partial-array task collection.
 *
 * @param {{tasks: Record<string, unknown>|Array<{taskId: string}>}} assignmentDefinition Assignment definition.
 * @returns {Array<string>} Declared task IDs.
 */
function resolveTaskIds(assignmentDefinition) {
  return Array.isArray(assignmentDefinition.tasks)
    ? assignmentDefinition.tasks.map((task) => task.taskId)
    : Object.keys(assignmentDefinition.tasks);
}

/**
 * Generates deterministic, roster-bound submissions and submission items for one
 * class assignment.
 *
 * @param {object} options Generation inputs.
 * @param {{name: string, seed: number}} options.profileDefinition Resolved profile definition; retained so call sites can pass the same inputs to every generator.
 * @param {{classId: string, students: Array<{id: string, name: string}>}} options.classDocument Persistence class document.
 * @param {{definitionKey: string, tasks: Record<string, unknown>|Array<{taskId: string}>}} options.assignmentDefinition Assignment definition referenced by the assignment.
 * @param {string} options.assignmentId Parent assignment ID.
 * @param {number} options.submissionCount Number of roster students to submit.
 * @param {number} options.assignmentIndex Assignment index used to vary deterministic timestamps.
 * @param {number} options.baseMinuteOffset Base timestamp offset for the owning class.
 * @returns {Array<object>} Full persistence-shaped submissions.
 */
export function generateSubmissions({
  classDocument,
  assignmentDefinition,
  assignmentId,
  submissionCount,
  assignmentIndex,
  baseMinuteOffset,
}) {
  const isPartialOnlyDefinition = Array.isArray(assignmentDefinition.tasks);
  const taskIds = resolveTaskIds(assignmentDefinition);
  const submissions = [];

  for (let studentIndex = 0; studentIndex < submissionCount; studentIndex += 1) {
    const student = classDocument.students.at(studentIndex);
    if (student === undefined) {
      break;
    }

    const createdMinuteOffset =
      baseMinuteOffset +
      assignmentIndex * MINUTES_PER_ASSIGNMENT +
      studentIndex * MINUTES_PER_STUDENT;
    const items = buildSubmissionItems({
      isPartialOnlyDefinition,
      assignmentId,
      student,
      studentIndex,
      createdMinuteOffset,
      taskIds,
    });

    submissions.push(
      buildSubmissionRecord({
        isPartialOnlyDefinition,
        assignmentId,
        student,
        studentIndex,
        createdMinuteOffset,
        items,
      })
    );
  }

  return submissions;
}
