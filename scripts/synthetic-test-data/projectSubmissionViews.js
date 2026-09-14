/**
 * Submission/artefact projection between persistence and the partial and full
 * transport views.
 *
 * @remarks
 * Partial views redact artefact content/contentHash and assessment reasoning;
 * full views retain them and preserve every persisted identifier exactly. No
 * projection fabricates a fallback identifier or default value.
 */

/**
 * Projects a persistence artifact into a redacted partial artifact.
 *
 * @param {object} artifact Persistence artifact.
 * @returns {object} Partial artifact with content/contentHash redacted to null.
 */
function toPartialArtifact(artifact) {
  return {
    taskId: artifact.taskId,
    role: artifact.role,
    pageId: artifact.pageId,
    documentId: artifact.documentId,
    content: null,
    contentHash: null,
    metadata: artifact.metadata,
    uid: artifact.uid,
    type: artifact.type,
  };
}

/**
 * Strips assessment reasoning from an assessment map.
 *
 * @param {Record<string, {score: number|'N', reasoning?: string}>} assessments Full assessment map.
 * @returns {Record<string, {score: number|'N'}>} Score-only assessment map.
 */
function stripAssessmentReasoning(assessments) {
  return Object.fromEntries(
    Object.entries(assessments).map(([criterion, assessment]) => [
      criterion,
      { score: assessment.score },
    ])
  );
}

/**
 * Projects a persistence submission item into a partial item.
 *
 * @param {object} item Persistence submission item.
 * @returns {object} StudentSubmissionItemPartial transport view.
 */
function toPartialItem(item) {
  return {
    id: item.id,
    taskId: item.taskId,
    artifact: toPartialArtifact(item.artifact),
    assessments: stripAssessmentReasoning(item.assessments),
    feedback: item.feedback,
  };
}

/**
 * Projects a persistence submission into a partial submission.
 *
 * @param {object} submission Persistence submission.
 * @returns {object} StudentSubmissionPartial transport view.
 */
export function toPartialSubmission(submission) {
  const items = Object.fromEntries(
    Object.entries(submission.items).map(([taskId, item]) => [taskId, toPartialItem(item)])
  );
  return {
    studentId: submission.studentId,
    studentName: submission.studentName,
    assignmentId: submission.assignmentId,
    documentId: submission.documentId,
    items,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
  };
}

/**
 * Projects a persistence artifact into a full transport artifact, retaining the
 * persisted identifiers exactly.
 *
 * @param {object} artifact Persistence artifact.
 * @returns {object} Full BaseTaskArtifact transport view.
 */
function toFullArtifact(artifact) {
  return {
    taskId: artifact.taskId,
    role: artifact.role,
    pageId: artifact.pageId,
    documentId: artifact.documentId,
    content: artifact.content,
    contentHash: artifact.contentHash,
    metadata: artifact.metadata,
    uid: artifact.uid,
    type: artifact.type,
  };
}

/**
 * Projects a persistence submission item into a full item.
 *
 * @param {object} item Persistence submission item.
 * @returns {object} StudentSubmissionItem transport view with reasoning retained.
 */
function toFullItem(item) {
  return {
    id: item.id,
    taskId: item.taskId,
    artifact: toFullArtifact(item.artifact),
    assessments: item.assessments,
    feedback: item.feedback,
  };
}

/**
 * Projects a persistence submission into a full submission, preserving every
 * persisted identifier and value exactly.
 *
 * @param {object} submission Persistence submission.
 * @returns {object} StudentSubmission transport view.
 */
export function toFullSubmission(submission) {
  const items = Object.fromEntries(
    Object.entries(submission.items).map(([taskId, item]) => [taskId, toFullItem(item)])
  );
  return {
    studentId: submission.studentId,
    studentName: submission.studentName,
    assignmentId: submission.assignmentId,
    documentId: submission.documentId,
    items,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
  };
}
