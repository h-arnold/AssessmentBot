import { assessmentResultSchema, partialAssessmentResultSchema } from './assessmentResult.zod';

const criteria = ['completeness', 'accuracy', 'spag'] as const;
const artifactTypes = new Set(['base', 'TEXT', 'TABLE', 'IMAGE', 'SPREADSHEET']);
type ItemSchema = {
  safeParse(
    value: unknown
  ):
    | { success: true; data: { artifact: unknown; assessments?: unknown } }
    | { success: false; data?: never };
};

/** Checks for a non-array object.
 * @param {unknown} value Candidate value.
 * @returns {boolean} Whether the value is a record.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Checks for a non-blank string identity.
 * @param {unknown} value Candidate identity.
 * @returns {boolean} Whether the identity is usable.
 */
export function isIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Checks whether a result map contains exactly the canonical criteria.
 * @param {unknown} value Candidate assessment map.
 * @returns {boolean} Whether all and only the three criteria are present.
 */
function hasExactCriteria(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === criteria.length &&
    criteria.every((key) => Object.hasOwn(value, key))
  );
}

/** Checks whether an ancillary record is empty.
 * @param {unknown} value Candidate record.
 * @returns {boolean} Whether it has no own enumerable entries.
 */
function hasNoEntries(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0;
}

/** Checks source fields required by a null-document placeholder.
 * @param {Record<string, unknown>} item Candidate item.
 * @param {boolean} isPartial Whether artefact bodies are redacted.
 * @returns {boolean} Whether the artefact contradicts the null parent.
 */
function hasInvalidNullParentArtifact(item: Record<string, unknown>, isPartial: boolean): boolean {
  const artifact = item.artifact;
  if (!isRecord(artifact)) return true;
  const invalidFields = [
    artifact.type !== 'base',
    artifact.role !== 'submission',
    artifact.documentId !== null,
    artifact.pageId !== null,
    !isPartial && (artifact.content !== null || artifact.contentHash !== null),
    !hasNoEntries(artifact.metadata),
    !hasNoEntries(item.feedback),
  ];
  return invalidFields.some(Boolean);
}

/** Checks that null-document items contain only acquisition or validation errors.
 * @param {Record<string, unknown>} assessments Candidate assessment map.
 * @param {boolean} isPartial Whether to use the partial result schema.
 * @returns {boolean} Whether any criterion contradicts the parent source state.
 */
function hasInvalidNullParentAssessments(
  assessments: Record<string, unknown>,
  isPartial: boolean
): boolean {
  const schema = isPartial ? partialAssessmentResultSchema : assessmentResultSchema;
  return criteria.some((key) => isInvalidNullParentResult(assessments[key], schema));
}

/** Checks one criterion against the null-parent E contract.
 * @param {unknown} result Candidate result.
 * @param {typeof assessmentResultSchema | typeof partialAssessmentResultSchema} schema Result schema.
 * @returns {boolean} Whether the result violates the contract.
 */
function isInvalidNullParentResult(
  result: unknown,
  schema: typeof assessmentResultSchema | typeof partialAssessmentResultSchema
): boolean {
  if (
    !schema.safeParse(result).success ||
    !isRecord(result) ||
    result.score !== 'E' ||
    !isRecord(result.error)
  )
    return true;
  return !['acquisition', 'validation'].includes(String(result.error.stage));
}

/** Checks whether item source data contradicts its parent submission.
 * @param {Record<string, unknown>} item Candidate item.
 * @param {unknown} parentDocumentId Parent submission document identity.
 * @param {boolean} isPartial Whether artefact bodies are redacted.
 * @returns {boolean} Whether the parent source is contradicted.
 */
function isContradictorySource(
  item: Record<string, unknown>,
  parentDocumentId: unknown,
  isPartial: boolean
): boolean {
  if (parentDocumentId !== null) return false;
  if (!hasExactCriteria(item.assessments)) return true;
  return (
    hasInvalidNullParentArtifact(item, isPartial) ||
    hasInvalidNullParentAssessments(item.assessments, isPartial)
  );
}

/** Checks that an artefact is associated with the supplied task submission.
 * @param {unknown} value Candidate artefact.
 * @param {string} taskId Canonical task identity.
 * @returns {boolean} Whether it is a supported submission artefact.
 */
function isSubmissionArtifact(value: unknown, taskId: string): boolean {
  if (!isRecord(value)) return false;
  return (
    value.taskId === taskId &&
    value.role === 'submission' &&
    isIdentity(value.uid) &&
    artifactTypes.has(String(value.type))
  );
}

/** Checks whether a full criterion is an allowed source-related E.
 * @param {unknown} value Candidate result.
 * @returns {boolean} Whether it is a source-related E result.
 */
function isNullSourceError(value: unknown): boolean {
  if (!isRecord(value) || value.score !== 'E' || !isRecord(value.error)) return false;
  return ['acquisition', 'extraction', 'validation'].includes(String(value.error.stage));
}

/** Checks whether every full criterion is a source-related E.
 * @param {Record<string, unknown>} assessments Validated result map.
 * @returns {boolean} Whether all criteria are source-related errors.
 */
function hasNullSourceResults(assessments: Record<string, unknown>): boolean {
  return criteria.every((criterion) => isNullSourceError(assessments[criterion]));
}

/** Validates a full item and its parent-source context.
 * @param {unknown} item Candidate item.
 * @param {string} taskId Canonical task identity.
 * @param {unknown} parentDocumentId Parent submission document identity.
 * @param {ItemSchema} schema Full item schema exposing safeParse.
 * @returns {boolean} Whether the item is valid.
 */
export function isValidFullItem(
  item: unknown,
  taskId: string,
  parentDocumentId: unknown,
  schema: ItemSchema
): boolean {
  if (!isRecord(item) || item.taskId !== taskId || !hasExactCriteria(item.assessments))
    return false;
  const parsed = schema.safeParse(item);
  if (
    !parsed.success ||
    isContradictorySource(item, parentDocumentId, false) ||
    !isSubmissionArtifact(parsed.data.artifact, taskId)
  )
    return false;
  return hasValidFullSource(parsed.data.artifact, parsed.data.assessments);
}

/**
 *
 * @param artifactValue
 * @param assessmentsValue
 */
/** Checks full source availability against the criterion outcomes.
 * @param {unknown} artifactValue Parsed full artefact.
 * @param {unknown} assessmentsValue Parsed full result map.
 * @returns {boolean} Whether the source state is valid.
 */
function hasValidFullSource(artifactValue: unknown, assessmentsValue: unknown): boolean {
  if (!isRecord(artifactValue) || !isRecord(assessmentsValue)) return false;
  if (artifactValue.content === null || artifactValue.contentHash === null) {
    return (
      artifactValue.content === null &&
      artifactValue.contentHash === null &&
      hasNullSourceResults(assessmentsValue)
    );
  }
  return true;
}

/** Validates a partial item and its parent-source context.
 * @param {unknown} item Candidate item.
 * @param {string} taskId Canonical task identity.
 * @param {unknown} parentDocumentId Parent submission document identity.
 * @param {ItemSchema} schema Partial item schema exposing safeParse.
 * @returns {boolean} Whether the item is valid.
 */
export function isValidPartialItem(
  item: unknown,
  taskId: string,
  parentDocumentId: unknown,
  schema: ItemSchema
): boolean {
  if (!isRecord(item) || item.taskId !== taskId || !hasExactCriteria(item.assessments))
    return false;
  const parsed = schema.safeParse(item);
  return (
    parsed.success &&
    !isContradictorySource(item, parentDocumentId, true) &&
    isSubmissionArtifact(parsed.data.artifact, taskId)
  );
}

/** Returns the raw item artefact when it is a record.
 * @param {unknown} existing Candidate item.
 * @returns {Record<string, unknown>} Artefact fields or an empty record.
 */
function existingArtifact(existing: unknown): Record<string, unknown> {
  if (!isRecord(existing) || !isRecord(existing.artifact)) return {};
  return existing.artifact;
}

/** Selects existing artefact fields retained by a partial replacement.
 * @param {Record<string, unknown>} artifact Existing artefact fields.
 * @param {boolean} isPartial Whether this is a partial projection.
 * @returns {Record<string, unknown>} Fields allowed on the replacement.
 */
function retainedArtifactFields(
  artifact: Record<string, unknown>,
  isPartial: boolean
): Record<string, unknown> {
  return isPartial ? artifact : {};
}

/** Returns an individually string-typed source ID when present.
 * @param {Record<string, unknown>} artifact Existing artefact fields.
 * @param {'pageId' | 'documentId'} field Source identity field.
 * @returns {string | null} The retained source ID.
 */
function sourceIdentity(
  artifact: Record<string, unknown>,
  field: 'pageId' | 'documentId'
): string | null {
  if (typeof artifact[field] !== 'string') return null;
  return artifact[field];
}

/** Creates a base artefact for an isolated invalid item.
 * @param {string} taskId Trusted task identity.
 * @param {Record<string, unknown>} artifact Existing artefact fields.
 * @param {boolean} isPartial Whether to retain partial source projection.
 * @returns {Record<string, unknown>} Canonical replacement artefact.
 */
function corruptedArtifact(
  taskId: string,
  artifact: Record<string, unknown>,
  isPartial: boolean
): Record<string, unknown> {
  return {
    ...retainedArtifactFields(artifact, isPartial),
    taskId,
    role: 'submission',
    uid: isIdentity(artifact.uid) ? artifact.uid : `corrupt-${taskId}`,
    type: 'base',
    pageId: sourceIdentity(artifact, 'pageId'),
    documentId: sourceIdentity(artifact, 'documentId'),
    metadata: {},
    ...(!isPartial && { content: null, contentHash: null }),
  };
}

/** Builds a canonical all-criterion corruption replacement.
 * @param {string} taskId Trusted task identity.
 * @param {unknown} existing Invalid item, when record-shaped.
 * @param {boolean} isPartial Whether to retain the partial artefact projection.
 * @param {Record<string, unknown>} corruptMap Canonical corruption assessments.
 * @returns {Record<string, unknown>} Replacement item.
 */
export function corruptItem(
  taskId: string,
  existing: unknown,
  isPartial: boolean,
  corruptMap: Record<string, unknown>
): Record<string, unknown> {
  const current = isRecord(existing) ? existing : {};
  const artifact = existingArtifact(existing);
  const id = isIdentity(current.id) ? current.id : `corrupt-${taskId}`;
  return {
    ...current,
    id,
    taskId,
    artifact: corruptedArtifact(taskId, artifact, isPartial),
    assessments: corruptMap,
    feedback: {},
  };
}

/** Finds the first malformed criterion's safe field path.
 * @param {Record<string, unknown>} assessments Candidate assessment map.
 * @param {string} fallback Item diagnostic path.
 * @param {boolean} isPartial Whether to validate partial results.
 * @returns {string | undefined} Criterion path when one is invalid.
 */
function invalidAssessmentPath(
  assessments: Record<string, unknown>,
  fallback: string,
  isPartial: boolean
): string | undefined {
  const schema = isPartial ? partialAssessmentResultSchema : assessmentResultSchema;
  const key = criteria.find((criterion) => !schema.safeParse(assessments[criterion]).success);
  return key === undefined ? undefined : `${fallback}.assessments.${key}`;
}

/** Finds a safe diagnostic path for an invalid item.
 * @param {unknown} item Candidate item.
 * @param {string} fallback Default item path.
 * @param {boolean} isPartial Whether to validate partial assessment results.
 * @returns {string} A field path containing no submitted values.
 */
export function itemErrorPath(item: unknown, fallback: string, isPartial: boolean): string {
  if (!isRecord(item)) return fallback;
  if (!isRecord(item.artifact)) return `${fallback}.artifact`;
  if (item.taskId === undefined) return `${fallback}.taskId`;
  if (!hasExactCriteria(item.assessments)) return `${fallback}.assessments`;
  return invalidAssessmentPath(item.assessments, fallback, isPartial) ?? fallback;
}
