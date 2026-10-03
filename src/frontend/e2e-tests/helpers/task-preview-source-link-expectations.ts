/**
 * Derived expectations for the issue #19 Section 4 Playwright source-link
 * walkthroughs.
 *
 * Turns the assignment record a journey actually serves into the exact editor
 * URL, metric-cell accessible label, score text and response body the browser
 * must render. Keeping this apart from
 * `task-preview-source-link-fixtures.ts` separates record selection from
 * expectation derivation, so both stay well under the module-size gate.
 *
 * @remarks
 * The editor URL is derived here from the raw stored identifiers rather than by
 * calling production code, so an assertion pins the rendered link to the mocked
 * record. No derived `sourceUrl` is ever placed in a mocked API payload.
 *
 * @see TASK_PREVIEW_SOURCE_LINK_LAYOUT.md
 * @see docs/developer/testing/synthetic-test-data.md
 */

import { METRIC_DISPLAY_META } from '../../src/services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { AssignmentFull } from '../../src/services/assignmentAssessment/assignmentAssessment.zod';
import {
  CANONICAL_SHEETS_ASSIGNMENT,
  CANONICAL_SLIDES_ASSIGNMENT,
  selectPrimarySubmission,
  selectPrimaryTaskDefinition,
  type CanonicalSubmission,
  type CanonicalSubmissionItem,
} from './task-preview-source-link-fixtures';

// ---------------------------------------------------------------------------
// Journey constants
// ---------------------------------------------------------------------------

/** Decimal places the heatmap metric sub-columns render (`INDIVIDUAL_SCORE_PRECISION`). */
const METRIC_CELL_SCORE_PRECISION = 0;

/** Metric sub-column the source-link walkthroughs read. */
const COMPLETENESS_METRIC_KEY = 'completeness';

/** Editor path segment per supported root document format. */
const EDITOR_PATH_SEGMENT: Readonly<Partial<Record<string, string>>> = {
  SLIDES: 'presentation',
  SHEETS: 'spreadsheets',
};

// ---------------------------------------------------------------------------
// Expected editor URLs
// ---------------------------------------------------------------------------

/**
 * Trim a stored document or page identifier to a usable value.
 *
 * @param {string | null | undefined} value - The raw stored identifier.
 * @returns {string | null} The trimmed identifier, or `null` when unusable.
 */
function trimStoredId(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Derive the expected editor source URL for one canonical submission item.
 *
 * Mirrors the delivered derivation rules: the document id comes from the
 * displayed artefact and falls back to the parent submission, the artefact page
 * id supplies the anchor, and an unusable page id yields the document root.
 *
 * @param {AssignmentFull} assignment - The assignment owning the submission.
 * @param {CanonicalSubmission} submission - The submission owning the item.
 * @param {CanonicalSubmissionItem} item - The displayed submission artefact.
 * @returns {string | null} The expected editor URL, or `null` when unavailable.
 */
export function deriveEditorSourceUrl(
  assignment: AssignmentFull,
  submission: CanonicalSubmission,
  item: CanonicalSubmissionItem
): string | null {
  const documentId = trimStoredId(item.artifact.documentId) ?? trimStoredId(submission.documentId);
  if (documentId === null) {
    return null;
  }
  const pathSegment = EDITOR_PATH_SEGMENT[assignment.documentType ?? ''];
  if (pathSegment === undefined) {
    return null;
  }

  const editorRoot = `https://docs.google.com/${pathSegment}/d/${encodeURIComponent(documentId)}/edit`;
  const pageId = trimStoredId(item.artifact.pageId);
  if (pageId === null) {
    return editorRoot;
  }

  const encodedPageId = encodeURIComponent(pageId);
  return assignment.documentType === 'SLIDES'
    ? `${editorRoot}#slide=id.${encodedPageId}`
    : `${editorRoot}#gid=${encodedPageId}`;
}

// ---------------------------------------------------------------------------
// Cell selections
// ---------------------------------------------------------------------------

/**
 * Everything a walkthrough asserts about one ready preview cell, derived from
 * the assignment record the browser is actually served.
 */
export interface SourceLinkCellSelection {
  /** Rostered student id owning the cell. */
  readonly studentId: string;
  /** Assignment the served record belongs to. */
  readonly assignmentId: string;
  /** Student display name carried by the canonical roster. */
  readonly studentName: string;
  /** Bare task id backing the cell. */
  readonly taskId: string;
  /** Human-readable task title from the embedded definition. */
  readonly taskTitle: string;
  /** Rendered score text of the completeness sub-column. */
  readonly scoreText: string;
  /** Shared `<td>`/trigger accessible label of the metric cell. */
  readonly cellAccessibleLabel: string;
  /**
   * Artefact body carried by the served submission item, or `''` when it has no
   * string content. The walkthrough that asserts a rendered body narrows this
   * through `deriveSourceLinkCell` (TEXT) or `deriveSourceLinkBodySelection`.
   */
  readonly artifactContent: string;
  /** Expected editor source URL, or `null` when the record offers no source. */
  readonly expectedSourceUrl: string | null;
}

/** A cell selection whose served record is known to offer an editor source. */
export type ReadySourceLinkCell = Omit<SourceLinkCellSelection, 'expectedSourceUrl'> &
  Readonly<{ expectedSourceUrl: string }>;

/**
 * Derive the rendered score text of one canonical completeness assessment.
 *
 * @remarks
 * A numeric assessment score renders with {@link METRIC_CELL_SCORE_PRECISION}
 * decimals; a non-numeric score is already the display literal the record
 * carries (`'N'` or `'E'`), so it is projected verbatim rather than restated.
 *
 * @param {CanonicalSubmissionItem} item - The submission item to read.
 * @returns {string} The rendered score text.
 */
function requireDisplayScoreText(item: CanonicalSubmissionItem): string {
  const score = item.assessments.completeness?.score;
  if (score == null) {
    throw new Error(
      `task-preview-source-link-expectations: ${item.taskId} carries no completeness score to render.`
    );
  }
  return typeof score === 'number' ? score.toFixed(METRIC_CELL_SCORE_PRECISION) : score;
}

/**
 * Project a stored artefact body into the text a cell selection carries.
 *
 * @remarks
 * The transport artefact union is wider than the preview renderers, so a body that
 * is not a string — a spreadsheet grid, or an untyped base artefact — has no text
 * form here. The walkthroughs that assert a rendered body narrow this explicitly
 * and fail loudly rather than comparing against an empty string.
 *
 * @param {unknown} content - The stored artefact content.
 * @returns {string} The body when it is a string, otherwise `''`.
 */
function toStoredBodyText(content: unknown): string {
  return typeof content === 'string' ? content : '';
}

/**
 * Read the TEXT artifact body of a submission item, failing loudly otherwise.
 *
 * @param {CanonicalSubmissionItem} item - The submission item to read.
 * @returns {string} The ready artifact body.
 */
function requireTextArtifactContent(item: CanonicalSubmissionItem): string {
  if (item.artifact.type !== 'TEXT' || typeof item.artifact.content !== 'string') {
    throw new Error(
      `task-preview-source-link-expectations: ${item.taskId} does not carry a TEXT body the walkthroughs expect.`
    );
  }
  return item.artifact.content;
}

/**
 * Read the metric label the heatmap sub-column renders for completeness.
 *
 * @returns {string} The metric display label.
 */
function requireMetricLabel(): string {
  const metricLabel = METRIC_DISPLAY_META.get(COMPLETENESS_METRIC_KEY)?.label;
  if (metricLabel === undefined) {
    throw new Error(
      `task-preview-source-link-expectations: metric ${COMPLETENESS_METRIC_KEY} carries no display label.`
    );
  }
  return metricLabel;
}

/** Submission item the cell resolves to. */
type ResolvedCellParts = Readonly<{
  selection: SourceLinkCellSelection;
  submission: CanonicalSubmission;
  taskId: string;
  item: CanonicalSubmissionItem;
}>;

/**
 * Resolve the submission, task and item a walkthrough reads from one record.
 *
 * Shared so the text journey and the unsupported-body journeys cannot drift in
 * how they choose a cell.
 *
 * @param {AssignmentFull} assignment - The served assignment record.
 * @returns {ResolvedCellParts} The resolved cell parts.
 */
function resolveCellParts(assignment: AssignmentFull): ResolvedCellParts {
  const submission = selectPrimarySubmission(assignment);
  const taskDefinition = selectPrimaryTaskDefinition(assignment);
  const item = submission.items[taskDefinition.id];
  if (item == null) {
    throw new Error(
      `task-preview-source-link-expectations: ${submission.studentId} has no item for ${taskDefinition.id}.`
    );
  }

  const scoreText = requireDisplayScoreText(item);
  const metricLabel = requireMetricLabel();

  return {
    submission,
    taskId: taskDefinition.id,
    item,
    selection: {
      studentId: submission.studentId,
      assignmentId: assignment.assignmentId,
      studentName: submission.studentName,
      taskId: taskDefinition.id,
      taskTitle: taskDefinition.taskTitle,
      scoreText,
      cellAccessibleLabel: `${submission.studentName}, ${taskDefinition.taskTitle}, ${metricLabel}: ${scoreText}`,
      artifactContent: toStoredBodyText(item.artifact.content),
      expectedSourceUrl: deriveEditorSourceUrl(assignment, submission, item),
    },
  };
}

/**
 * Derive the walkthrough's ready cell from an assignment record, whether it is
 * the canonical one or a boundary variant.
 *
 * @remarks
 * Every text journey reads the rendered body through this cell, so it requires the
 * served record to carry a TEXT body. A walkthrough that must exercise the image
 * or table renderer uses `deriveSourceLinkBodySelection` instead, which accepts
 * those body types.
 *
 * @param {AssignmentFull} assignment - The served assignment record.
 * @returns {SourceLinkCellSelection} The derived cell selection.
 */
export function deriveSourceLinkCell(assignment: AssignmentFull): SourceLinkCellSelection {
  const resolved = resolveCellParts(assignment);
  return {
    ...resolved.selection,
    artifactContent: requireTextArtifactContent(resolved.item),
  };
}

/**
 * Narrow a derived cell to one that must offer an editor source, failing loudly
 * when the record no longer carries a usable document.
 *
 * @remarks
 * Exported so a walkthrough that asserts a rendered `href` narrows its cell
 * through this guard instead of hiding the nullability behind a non-null
 * assertion: a boundary variant that stopped resolving a URL has to fail loudly
 * rather than assert `href === null`.
 *
 * @param {SourceLinkCellSelection} selection - The derived cell selection.
 * @returns {ReadySourceLinkCell} The narrowed selection with a required URL.
 */
export function requireReadyCell(selection: SourceLinkCellSelection): ReadySourceLinkCell {
  if (selection.expectedSourceUrl === null) {
    throw new Error(
      `task-preview-source-link-expectations: the ${selection.assignmentId} cell for ${selection.studentId} / ${selection.taskId} offers no editor source.`
    );
  }
  return { ...selection, expectedSourceUrl: selection.expectedSourceUrl };
}

/** Ready-cell selection derived from the canonical Slides assignment. */
export const CANONICAL_SLIDES_CELL: ReadySourceLinkCell = requireReadyCell(
  deriveSourceLinkCell(CANONICAL_SLIDES_ASSIGNMENT)
);

/** Ready-cell selection derived from the canonical Sheets assignment. */
export const CANONICAL_SHEETS_CELL: ReadySourceLinkCell = requireReadyCell(
  deriveSourceLinkCell(CANONICAL_SHEETS_ASSIGNMENT)
);

/** What a walkthrough needs to assert one preview's rendered body. */
export interface SourceLinkBodySelection {
  /** Shared `<td>`/trigger accessible label of the metric cell. */
  readonly cellAccessibleLabel: string;
  /** Which body renderer the served record must produce. */
  readonly artifactType: RenderableBodyType;
  /** The body string the served record carries. */
  readonly artifactContent: string;
  /** Expected editor source URL for the same served item. */
  readonly expectedSourceUrl: string;
}

/**
 * The artefact types `TaskPreviewCard` can render.
 *
 * @remarks
 * The transport artefact union is wider than the preview renderers: a
 * `SPREADSHEET` or `base` artefact has no body renderer, so a body walkthrough
 * must fail loudly rather than assert against a card that shows a placeholder.
 */
const RENDERABLE_BODY_TYPES = ['IMAGE', 'TEXT', 'TABLE'] as const;

/** One artefact type the preview card renders. */
type RenderableBodyType = (typeof RENDERABLE_BODY_TYPES)[number];

/**
 * Narrow a stored artefact type to one the preview card can render.
 *
 * @param {string} artifactType - The stored artefact type.
 * @returns {boolean} Whether a body renderer exists for it.
 */
function isRenderableBodyType(artifactType: string): artifactType is RenderableBodyType {
  return (RENDERABLE_BODY_TYPES as ReadonlyArray<string>).includes(artifactType);
}

/**
 * Derive the expectations for a preview whose body is not necessarily TEXT.
 *
 * @remarks
 * The IMAGE and TABLE bodies come from the recorded local-content exception, so
 * the cell choice, score, label and source URL still derive from the canonical
 * record rather than from the reused body.
 *
 * @param {AssignmentFull} assignment - The served assignment record.
 * @returns {SourceLinkBodySelection} The derived body selection.
 */
export function deriveSourceLinkBodySelection(assignment: AssignmentFull): SourceLinkBodySelection {
  const { item, selection } = resolveCellParts(assignment);
  const content = item.artifact.content;
  if (typeof content !== 'string') {
    throw new TypeError(
      `task-preview-source-link-expectations: ${item.taskId} carries no string artefact content to render.`
    );
  }
  if (!isRenderableBodyType(item.artifact.type)) {
    throw new TypeError(
      `task-preview-source-link-expectations: a ${item.artifact.type} artefact has no preview body renderer, so ${item.taskId} cannot back a body walkthrough.`
    );
  }
  const expectedSourceUrl = selection.expectedSourceUrl;
  if (expectedSourceUrl === null) {
    throw new Error(
      `task-preview-source-link-expectations: ${selection.assignmentId} cell for ${selection.studentId} offers no editor source.`
    );
  }

  return {
    cellAccessibleLabel: selection.cellAccessibleLabel,
    artifactType: item.artifact.type,
    artifactContent: content,
    expectedSourceUrl,
  };
}
