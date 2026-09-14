import { isoAt } from './deterministicPrimitives.js';

const STUDENT_INDEX_WITH_NULL_DOCUMENT = 2;
const STUDENT_INDEX_WITH_NULL_ARTIFACT_IDS = 3;
const STUDENT_INDEX_WITHOUT_ASSESSMENTS = 1;
const STUDENT_INDEX_WITH_NON_APPLICABLE_SPAG = 0;
const MAX_NUMERIC_SCORE = 5;
const MINUTES_BETWEEN_SUBMISSION_UPDATES = 5;
const MINUTES_PER_ASSIGNMENT = 60;
const MINUTES_PER_STUDENT = 7;

/**
 * Builds the assessment map for a synthetic submission item.
 *
 * @param {number} studentIndex Roster index of the student.
 * @returns {Record<string, {score: number|'N', reasoning: string}>} Assessment entries keyed by criterion.
 */
function buildAssessments(studentIndex) {
  const numericScore = studentIndex % (MAX_NUMERIC_SCORE + 1);
  const spagScore = studentIndex === STUDENT_INDEX_WITH_NON_APPLICABLE_SPAG ? 'N' : numericScore;
  return {
    completeness: {
      score: numericScore,
      reasoning: `Synthetic completeness rationale for student index ${studentIndex}.`,
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
 * Builds one submission item, including its task artifact.
 *
 * @param {object} options Item inputs.
 * @param {string} options.assignmentId Parent assignment ID.
 * @param {string} options.studentId Roster student ID.
 * @param {number} options.studentIndex Roster index of the student.
 * @param {string} options.taskId Declared task ID.
 * @param {number} options.createdMinuteOffset Deterministic created-at offset.
 * @param {boolean} options.hasNullableArtifactIds Whether this partial-only item omits its persisted artifact IDs.
 * @returns {object} A full persistence-shaped submission item.
 */
function buildSubmissionItem({
  assignmentId,
  studentId,
  studentIndex,
  taskId,
  createdMinuteOffset,
  hasNullableArtifactIds,
}) {
  const identifierSuffix = `${assignmentId}-${studentId}-${taskId}`;
  const assessments =
    studentIndex === STUDENT_INDEX_WITHOUT_ASSESSMENTS ? {} : buildAssessments(studentIndex);

  return {
    id: `ssi-${identifierSuffix}`,
    taskId,
    artifact: {
      taskId,
      role: 'submission',
      pageId: hasNullableArtifactIds ? null : `page-${taskId}`,
      documentId: hasNullableArtifactIds ? null : `artifact-document-${identifierSuffix}`,
      content: `Synthetic submission content for ${identifierSuffix}`,
      contentHash: `hash-${identifierSuffix}`,
      metadata: {},
      uid: `uid-${identifierSuffix}`,
      type: 'TEXT',
    },
    assessments,
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
    taskIds.map((taskId) => [
      taskId,
      buildSubmissionItem({
        assignmentId,
        studentId: student.id,
        studentIndex,
        taskId,
        createdMinuteOffset,
        hasNullableArtifactIds:
          isPartialOnlyDefinition && studentIndex === STUDENT_INDEX_WITH_NULL_ARTIFACT_IDS,
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
