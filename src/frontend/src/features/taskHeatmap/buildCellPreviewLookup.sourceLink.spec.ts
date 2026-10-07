/**
 * Source-URL derivation tests for `buildCellPreviewLookup`.
 *
 * Pins the derived `sourceUrl` contract: the editor link is resolved from the
 * root assignment's document format (`SLIDES` / `SHEETS`) plus the stored
 * artefact document ID (falling back to the parent submission's), trimmed and
 * encoded as URL components, with the stored artefact page ID as the
 * slide/sheet anchor and a document-root fallback when no usable page ID
 * exists. An unusable format or document ID yields `null`; reference/template
 * documents, image-export `metadata.sourceUrl` and definition task page IDs
 * are never substituted.
 *
 * Realistic setup comes from the canonical `small` records selected by
 * `src/test/taskHeatmap/previewFixtures.ts` (Slides `assignment-2-1` and
 * Sheets `assignment-2-2`). Every conflicting, null, blank or unrecognised
 * variant is a deliberate boundary probe cloned from those records, and the
 * expected URLs are built from the same stored IDs by
 * `buildExpectedSourceUrl`.
 *
 * Key construction, indexing and cell-content derivation are covered by the
 * sibling `buildCellPreviewLookup*.spec.ts` suites.
 */

import { describe, it, expect } from 'vitest';
import { buildTaskKey } from '../../services/dataAnalysis/taskKey';
import { buildCellPreviewLookup } from './buildCellPreviewLookup';
import type { AssignmentFull } from '../../services/assignmentAssessment/assignmentAssessment.zod';
import { buildExpectedSourceUrl } from '../../test/taskHeatmap/buildCellPreviewLookupTestFixtures';
import {
  cloneCanonicalSlidesAssignment,
  cloneCanonicalSheetsAssignment,
} from '../../test/taskHeatmap/previewFixtures';

/** Submission item shape carried by an `AssignmentFull` submission. */
type AssignmentSubmissionItem = AssignmentFull['submissions'][number]['items'][string];

/** First student/task selection read from a cloned canonical assignment. */
interface FirstSourceCell {
  /** Student owning the first submission. */
  readonly studentId: string;
  /** Task carried by the submission's first item. */
  readonly taskId: string;
  /** Composite lookup key for the selected cell. */
  readonly taskKey: string;
  /** The submission item whose stored IDs drive the derived URL. */
  readonly item: AssignmentSubmissionItem;
}

/**
 * Select the first submission's cell from an assignment, failing loudly when
 * the canonical record no longer carries submissions or items.
 *
 * @param {AssignmentFull} assignment - The cloned canonical assignment.
 * @returns {FirstSourceCell} The selected cell identifiers and item.
 */
function selectFirstSourceCell(assignment: AssignmentFull): FirstSourceCell {
  const submission = assignment.submissions[0];
  if (submission == null) {
    throw new Error('sourceLink spec: the assignment carries no submissions to select from.');
  }
  const item = Object.values(submission.items)[0];
  if (item == null) {
    throw new Error(
      `sourceLink spec: submission ${submission.studentId} carries no items to select from.`
    );
  }
  const definitionKey = assignment.assignmentDefinition.definitionKey;
  return {
    studentId: submission.studentId,
    taskId: item.taskId,
    taskKey: buildTaskKey(definitionKey, item.taskId),
    item,
  };
}

/**
 * Read the parent submission's stored document ID, failing loudly when the
 * canonical record no longer carries one.
 *
 * @param {AssignmentFull} assignment - The cloned canonical assignment.
 * @returns {string} The parent submission's document ID.
 */
function requireParentDocumentId(assignment: AssignmentFull): string {
  const documentId = assignment.submissions[0]?.documentId;
  if (documentId == null) {
    throw new Error('sourceLink spec: the canonical submission carries no parent document ID.');
  }
  return documentId;
}

/**
 * Derive a cell's `sourceUrl` through the production lookup.
 *
 * @param {AssignmentFull} assignment - Assignment whose lookup to build.
 * @param {string} studentId - Student owning the cell.
 * @param {string} taskKey - Composite lookup key of the cell.
 * @returns {string | null} The derived editor source URL.
 */
function deriveSourceUrl(
  assignment: AssignmentFull,
  studentId: string,
  taskKey: string
): string | null {
  const cell = buildCellPreviewLookup(assignment).get(studentId)?.get(taskKey);
  if (cell == null) {
    throw new Error(`sourceLink spec: no cell for ${studentId} / ${taskKey}.`);
  }
  return cell.sourceUrl;
}

describe('buildCellPreviewLookup source URL derivation', () => {
  // -----------------------------------------------------------------------
  // Canonical anchors for both supported formats
  // -----------------------------------------------------------------------

  describe('canonical editor anchors', () => {
    it('derives the Slides #slide=id anchor from the canonical Slides assignment', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);

      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBe(
        buildExpectedSourceUrl('SLIDES', item.artifact.documentId, item.artifact.pageId)
      );
    });

    it('derives the Sheets #gid anchor from the root format of the canonical Sheets assignment', () => {
      const assignment = cloneCanonicalSheetsAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);

      // The format comes from the root assignment's documentType even though
      // the submission artifact itself carries a TEXT body.
      expect(assignment.documentType).toBe('SHEETS');
      expect(item.artifact.type).toBe('TEXT');
      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBe(
        buildExpectedSourceUrl('SHEETS', item.artifact.documentId, item.artifact.pageId)
      );
    });
  });

  // -----------------------------------------------------------------------
  // Document ID preference and fallbacks
  // -----------------------------------------------------------------------

  describe('document ID preference and fallbacks', () => {
    it('prefers the artifact documentId over the parent submission documentId', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);
      item.artifact.documentId = 'artefact-preferred-document';

      // The parent submission keeps its own, different stored document ID, so
      // an artefact-first resolution cannot coincide with a parent-based URL.
      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBe(
        buildExpectedSourceUrl('SLIDES', item.artifact.documentId, item.artifact.pageId)
      );
    });

    it('falls back to the parent submission documentId when the artifact documentId is null', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);
      item.artifact.documentId = null;

      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBe(
        buildExpectedSourceUrl('SLIDES', requireParentDocumentId(assignment), item.artifact.pageId)
      );
    });

    it('falls back to the parent submission documentId when the artifact documentId is blank', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);
      item.artifact.documentId = '   ';

      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBe(
        buildExpectedSourceUrl('SLIDES', requireParentDocumentId(assignment), item.artifact.pageId)
      );
    });

    it('falls back to the parent documentId with no fragment when the artifact documentId and pageId are both unusable', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);
      item.artifact.documentId = '   ';
      item.artifact.pageId = '   ';

      // The parent document wins the ID resolution, while the unusable page
      // ID still yields the document-root URL with no slide fragment.
      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBe(
        buildExpectedSourceUrl('SLIDES', requireParentDocumentId(assignment), null)
      );
    });

    it('returns null when neither the artifact nor the parent documentId is usable', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);
      item.artifact.documentId = null;
      assignment.submissions[0].documentId = '   ';

      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Page ID anchors and document-root fallback
  // -----------------------------------------------------------------------

  describe('page ID anchors', () => {
    it('omits the fragment when the artifact pageId is null (document root fallback)', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);
      item.artifact.pageId = null;

      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBe(
        buildExpectedSourceUrl('SLIDES', item.artifact.documentId, null)
      );
    });

    it('omits the fragment when the artifact pageId is blank', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);
      item.artifact.pageId = '   ';

      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBe(
        buildExpectedSourceUrl('SLIDES', item.artifact.documentId, null)
      );
    });

    it('keeps the Sheets "0" pageId as a valid gid anchor', () => {
      const assignment = cloneCanonicalSheetsAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);
      item.artifact.pageId = '0';

      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBe(
        buildExpectedSourceUrl('SHEETS', item.artifact.documentId, '0')
      );
    });

    it('uses the Sheets editor root URL when the artifact pageId is unusable', () => {
      const assignment = cloneCanonicalSheetsAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);
      item.artifact.pageId = null;

      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBe(
        `https://docs.google.com/spreadsheets/d/${encodeURIComponent(item.artifact.documentId!)}/edit`
      );
    });

    it('encodes a Sheets gid fragment independently of the expected-URL helper', () => {
      const assignment = cloneCanonicalSheetsAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);
      item.artifact.pageId = '  tab 1/final  ';

      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBe(
        `https://docs.google.com/spreadsheets/d/${encodeURIComponent(item.artifact.documentId!)}/edit#gid=tab%201%2Ffinal`
      );
    });

    it('trims and encodes stored documentId and pageId components', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);
      item.artifact.documentId = '  slides doc/1  ';
      item.artifact.pageId = '  slide 1/final  ';

      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBe(
        buildExpectedSourceUrl('SLIDES', item.artifact.documentId, item.artifact.pageId)
      );
    });
  });

  // -----------------------------------------------------------------------
  // Document format resolution
  // -----------------------------------------------------------------------

  describe('document format resolution', () => {
    it('returns null when the root documentType is an unsupported format', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey } = selectFirstSourceCell(assignment);
      assignment.documentType = 'DOCS';

      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBeNull();
    });

    it('returns null when the root documentType is null', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey } = selectFirstSourceCell(assignment);
      assignment.documentType = null;

      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBeNull();
    });

    it('does not infer the format from the artifact content type', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);
      item.artifact = { ...item.artifact, type: 'SPREADSHEET', content: null };

      expect(assignment.documentType).toBe('SLIDES');
      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBe(
        buildExpectedSourceUrl('SLIDES', item.artifact.documentId, item.artifact.pageId)
      );
    });
  });

  // -----------------------------------------------------------------------
  // Stored sources that must never be substituted
  // -----------------------------------------------------------------------

  describe('no substituted sources', () => {
    it('never substitutes a reference or template document', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);
      item.artifact.documentId = null;
      assignment.submissions[0].documentId = null;

      // Both definition documents remain present, so a substitution bug could
      // still produce a link from the wrong document.
      expect(assignment.referenceDocumentId).not.toBeNull();
      expect(assignment.templateDocumentId).not.toBeNull();
      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBeNull();
    });

    it('never uses image-export metadata.sourceUrl', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey, item } = selectFirstSourceCell(assignment);
      const exportMetadataUrl = 'https://drive.google.com/uc?export=view&id=export-1';
      item.artifact.metadata = { ...item.artifact.metadata, sourceUrl: exportMetadataUrl };

      const sourceUrl = deriveSourceUrl(assignment, studentId, taskKey);

      expect(sourceUrl).toBe(
        buildExpectedSourceUrl('SLIDES', item.artifact.documentId, item.artifact.pageId)
      );
      expect(sourceUrl).not.toBe(exportMetadataUrl);
    });

    it('never fills a missing student pageId from the definition task pageId', () => {
      const assignment = cloneCanonicalSlidesAssignment();
      const { studentId, taskKey, taskId, item } = selectFirstSourceCell(assignment);
      item.artifact.pageId = null;
      const definitionPageId = assignment.assignmentDefinition.tasks[taskId].pageId;
      expect(definitionPageId).not.toBe('');

      expect(deriveSourceUrl(assignment, studentId, taskKey)).toBe(
        buildExpectedSourceUrl('SLIDES', item.artifact.documentId, null)
      );
    });
  });
});
