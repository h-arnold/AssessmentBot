/**
 * Shared fixture primitives for the `buildCellPreviewLookup` spec family.
 *
 * Co-located with the other task-heatmap preview fixtures under
 * `src/test/taskHeatmap/`, and kept in a non-spec module so
 * `buildCellPreviewLookup.spec.ts`,
 * `buildCellPreviewLookup.content.spec.ts` and
 * `buildCellPreviewLookup.indexing.spec.ts` can import them without vitest
 * double-collecting the test files, and without each split suite growing its
 * own competing copy of the same assignment payload.
 */

import type { AssignmentFull } from '../../services/assignmentAssessment/assignmentAssessment.zod';

export const DEFAULT_DATE = '2024-01-01T00:00:00.000Z';

/**
 * Base artifact fields shared by all artifact types (BaseTaskArtifactFields).
 * `taskId` is intentionally excluded here because it varies per item and is
 * always supplied inline.
 *
 * @remarks
 * Provenance: these are schematic boundary-field defaults, not a projection
 * of any canonical synthetic record — realistic labels, IDs and content are
 * derived from the corpus in `previewFixtures.ts`, never restated here.
 *
 * Coincidence hazard: reusing the same `pageId`/`documentId` between an
 * artefact and its parent submission lets a derivation that accidentally
 * prefers the parent pass unnoticed. Do not rely on coincidence here; the
 * non-coincidence pattern the source-link spec pins is its
 * 'prefers the artifact documentId over the parent submission documentId'
 * case, which deliberately sets distinct stored IDs.
 */
export const BASE_ARTIFACT_FIELDS = {
  role: 'student',
  pageId: 'pg-1',
  documentId: 'doc-1',
  uid: 'uid-1',
  contentHash: null as string | null,
  metadata: {},
};

/**
 * Minimal AssignmentDefinition that satisfies the Zod-mandated required
 * fields.  Most optional / nullable fields are set to `null` or default
 * values.
 */
const MINIMAL_ASSIGNMENT_DEFINITION = {
  primaryTitle: 'Test Assignment',
  primaryTopic: null,
  primaryTopicKey: null,
  yearGroupKey: 'yg-10',
  yearGroupLabel: null,
  alternateTitles: [],
  alternateTopics: [],
  documentType: null,
  referenceDocumentId: null,
  templateDocumentId: null,
  referenceLastModified: null,
  templateLastModified: null,
  assignmentWeighting: 1,
  definitionKey: 'test-def',
  tasks: {},
  createdAt: DEFAULT_DATE,
  updatedAt: DEFAULT_DATE,
};

/**
 * Build a minimal `AssignmentFull` with the given submissions.
 * All other fields get sensible defaults so each test only
 * specifies the data it cares about.
 *
 * The submissions and the embedded assignment definition are deep-cloned per
 * call, so mutating a returned assignment can never leak back into the shared
 * `BASE_ARTIFACT_FIELDS` metadata or the module-level minimal definition and
 * poison later tests.
 *
 * @param {AssignmentFull['submissions']} submissions - The submissions to include in the assignment.
 * @returns {AssignmentFull} A minimal AssignmentFull object.
 */
export function createAssignment(submissions: AssignmentFull['submissions']): AssignmentFull {
  return {
    courseId: 'course-1',
    assignmentId: 'assignment-1',
    assignmentName: 'Test Assignment',
    dueDate: null,
    updatedAt: null,
    createdAt: DEFAULT_DATE,
    documentType: null,
    referenceDocumentId: null,
    templateDocumentId: null,
    tasks: null,
    submissions: structuredClone(submissions),
    assignmentDefinition: structuredClone(MINIMAL_ASSIGNMENT_DEFINITION),
  } as AssignmentFull;
}

/**
 * Validate an expected document ID, failing loudly on `null` or a blank
 * (empty/whitespace-only) value.
 *
 * @remarks
 * An expected editor URL can only be derived from a usable document ID. A
 * null or blank expectation means the caller's fixture cannot produce a URL
 * at all, so this fails loudly instead of letting a fabricated URL silently
 * weaken the caller's assertion.
 *
 * @param {string | null} documentId - Stored document identifier (artefact or parent).
 * @returns {string} The trimmed, usable document ID.
 * @throws {Error} When `documentId` is `null` or blank.
 */
function requireExpectedDocumentId(documentId: string | null): string {
  if (documentId == null) {
    throw new Error(
      'buildExpectedSourceUrl: expected document ID is null; no editor URL can be derived from an unusable document ID.'
    );
  }
  const trimmedDocumentId = documentId.trim();
  if (trimmedDocumentId === '') {
    throw new Error(
      'buildExpectedSourceUrl: expected document ID is blank; no editor URL can be derived from an unusable document ID.'
    );
  }
  return trimmedDocumentId;
}

/**
 * Build the expected derived editor source URL for a stored document format and
 * IDs, restating the documented URL-resolution contract so the spec family
 * asserts against record data instead of restating realistic URL literals.
 *
 * Mirrors the contract: trim each identifier, encode it as a URL component,
 * use the fixed HTTPS Google Docs editor host and path for the format, and
 * omit the fragment when no usable page ID is stored.
 *
 * The document ID is honestly typed `string | null` because stored artefact
 * and parent `documentId` fields are nullable. An expected URL can only be
 * built from a usable (non-null, non-blank) document ID, so a null or blank
 * expectation fails loudly here instead of being coerced into a fabricated
 * URL that would silently weaken the caller's assertion.
 *
 * @param {'SLIDES' | 'SHEETS'} documentType - Root assignment document format.
 * @param {string | null} documentId - Stored document identifier (artefact or
 *        parent); must be a non-blank string.
 * @param {string | null} [pageId] - Stored page identifier, when present.
 * @returns {string} The expected editor source URL.
 * @throws {Error} When `documentId` is `null` or blank, because no editor URL
 *         can be derived from an unusable expected document ID.
 */
export function buildExpectedSourceUrl(
  documentType: 'SLIDES' | 'SHEETS',
  documentId: string | null,
  pageId?: string | null
): string {
  const encodedDocumentId = encodeURIComponent(requireExpectedDocumentId(documentId));
  const baseUrl =
    documentType === 'SLIDES'
      ? `https://docs.google.com/presentation/d/${encodedDocumentId}/edit`
      : `https://docs.google.com/spreadsheets/d/${encodedDocumentId}/edit`;
  const trimmedPageId = pageId?.trim() ?? '';
  if (trimmedPageId === '') {
    return baseUrl;
  }
  const encodedPageId = encodeURIComponent(trimmedPageId);
  return documentType === 'SLIDES'
    ? `${baseUrl}#slide=id.${encodedPageId}`
    : `${baseUrl}#gid=${encodedPageId}`;
}
