/**
 * Canonical synthetic `small` fixture selection for the issue #19 Section 4
 * Playwright source-link walkthroughs.
 *
 * Selects the trustworthy `class-2` roster, its populated Slides
 * `assignment-2-1` and its populated Sheets `assignment-2-2` from the committed
 * transport views using the Node-side direct-JSON-import convention already
 * used by `stale-recovery-page-end-to-end-helpers.ts`, validates every selected
 * full record through its real transport schema, and owns the boundary variants
 * that clone a canonical record before mutating a stored source identifier.
 *
 * @remarks
 * Selected records are deep-frozen, so callers clone a record before mutating
 * anything. No derived `sourceUrl` is ever placed in a mocked API payload: the
 * expected editor URL is derived by the sibling
 * `task-preview-source-link-expectations.ts` module from the raw stored
 * identifiers and compared with what the browser renders.
 *
 * This module selects from the existing corpus; it is not a second fixture
 * corpus and it never restates realistic labels, scores or content as literals.
 * Deliberately invalid and boundary records stay with the owning specs.
 *
 * @see docs/developer/testing/synthetic-test-data.md
 * @see docs/developer/frontend/frontend-playwright-e2e.md
 */

import {
  AssignmentFullSchema,
  type AssignmentFull,
} from '../../src/services/assignmentAssessment/assignmentAssessment.zod';
import { HEATMAP_UNSUPPORTED_ARTIFACT_CONTENT } from './task-heatmap-fixtures';
import {
  ClassFullSchema,
  type ClassFull,
} from '../../src/services/googleClassrooms/classDetail/classDetailService.zod';
import classPartialsRaw from '../../../../tests/__mocks__/data/synthetic-analysis/small/classPartials.json';
import classesByIdRaw from '../../../../tests/__mocks__/data/synthetic-analysis/small/classesById.json';
import assignmentDefinitionPartialsRaw from '../../../../tests/__mocks__/data/synthetic-analysis/small/assignmentDefinitionPartials.json';
import assignmentsByKeyRaw from '../../../../tests/__mocks__/data/synthetic-analysis/small/assignmentsByKey.json';

// ---------------------------------------------------------------------------
// Canonical fixture shapes
// ---------------------------------------------------------------------------

/** Class partial row as shipped by the canonical `small` profile. */
type CanonicalClassPartial = Readonly<{
  classId: string;
  className: string | null;
  yearGroupKey: string | null;
}>;

/**
 * A class partial row proven trustworthy for the browser journeys.
 *
 * `selectClassPartial` throws unless both nullable trust fields carry a value,
 * so a selected row is known to be navigable and to key a year-group panel
 * without any further narrowing.
 */
type TrustworthyClassPartial = Omit<CanonicalClassPartial, 'className' | 'yearGroupKey'> &
  Readonly<{ className: string; yearGroupKey: string }>;

/** Assignment-definition partial row as shipped by the canonical `small` profile. */
type CanonicalDefinitionPartial = Readonly<{
  definitionKey: string;
  primaryTitle: string;
  primaryTopic: string;
  primaryTopicKey: string;
  yearGroupKey: string;
  yearGroupLabel: string;
}>;

/** Submission record carried by a validated canonical `AssignmentFull`. */
export type CanonicalSubmission = AssignmentFull['submissions'][number];

/** Submission item carried by a canonical submission. */
export type CanonicalSubmissionItem = CanonicalSubmission['items'][string];

/** Embedded task definition carried by a canonical `AssignmentFull`. */
export type CanonicalTaskDefinition = AssignmentFull['assignmentDefinition']['tasks'][string];

/** One year-group reference record consumed by the Classes page panels. */
export type CanonicalYearGroup = Readonly<{ key: string; name: string }>;

const classPartials = classPartialsRaw as unknown as ReadonlyArray<CanonicalClassPartial>;
const classesById = classesByIdRaw as unknown as Record<string, unknown>;
const definitionPartials =
  assignmentDefinitionPartialsRaw as unknown as ReadonlyArray<CanonicalDefinitionPartial>;
const assignmentsByKey = assignmentsByKeyRaw as unknown as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Journey identifiers
// ---------------------------------------------------------------------------

/** Canonical trustworthy class exercised by both Section 4 entry points. */
export const SOURCE_LINK_CLASS_ID = 'class-2';

/**
 * Canonical assignment the Class page warms first (newest `updatedAt`).
 *
 * @remarks
 * Its embedded definition is partial-only (`definition-partial-0`), so the
 * corpus deliberately ships no full record for it and it never hydrates into
 * `assignmentsByKey`. There is therefore no canonical payload to serve for it,
 * and the warm-up request is answered with `getAssignment`'s documented
 * not-found result instead of a rewritten copy of another assignment.
 *
 * It is a warm-up target only: no journey cell is derived from it, so this
 * identity stays local and the guard below keeps the reasoning honest — if the
 * corpus ever ships a full record for it, the `null` answer stops being the
 * truthful response and this module fails loudly rather than letting a stale
 * assumption reach a journey queue.
 */
const WARM_PREFETCH_ASSIGNMENT_ID = 'assignment-2-3';

if (assignmentsByKey[WARM_PREFETCH_ASSIGNMENT_ID] != null) {
  throw new Error(
    `task-preview-source-link-fixtures: ${WARM_PREFETCH_ASSIGNMENT_ID} now ships a full record, so the embedded journey must serve that record instead of answering null.`
  );
}

/** Canonical populated Slides assignment opened from the Recent Assignments card. */
export const SLIDES_ASSIGNMENT_ID = 'assignment-2-1';

/** Canonical populated Sheets assignment used for the second editor URL shape. */
export const SHEETS_ASSIGNMENT_ID = 'assignment-2-2';

/**
 * Exact accessible name and tooltip text required on the source action.
 *
 * @see TASK_PREVIEW_SOURCE_LINK_LAYOUT.md — Source region
 */
export const SOURCE_DOCUMENT_ACTION_LABEL = 'Open source document (opens in a new tab)';

/** Accessible name of the task heatmap table on both entry points. */
export const HEATMAP_TABLE_NAME = 'Task Heatmap';

/**
 * Valid Sheets tab id that must survive verbatim into the link fragment.
 *
 * @see SPEC.md — the Sheets value `"0"` is a valid gid
 */
const NUMERIC_SHEETS_PAGE_ID = '0';

// ---------------------------------------------------------------------------
// Canonical selection
// ---------------------------------------------------------------------------

/**
 * Deep-freeze a selected canonical record so in-place mutation fails loudly
 * instead of leaking across specs.
 *
 * @template T - Type of the value being frozen.
 * @param {T} value - The record to freeze.
 * @returns {T} The same record, with every reachable object frozen.
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  for (const propertyValue of Object.values(value)) {
    deepFreeze(propertyValue);
  }
  return Object.freeze(value);
}

/**
 * Read one keyed record from a parsed transport view, failing loudly when absent.
 *
 * @param {Record<string, unknown>} view - Parsed transport view keyed by record ID.
 * @param {string} recordId - ID of the record to select.
 * @param {string} viewName - View name quoted in the failure message.
 * @returns {unknown} The selected raw record.
 */
function requireRecord(view: Record<string, unknown>, recordId: string, viewName: string): unknown {
  const record = view[recordId];
  if (record == null) {
    throw new Error(
      `task-preview-source-link-fixtures: "${recordId}" is absent from the small synthetic ${viewName} view.`
    );
  }
  return record;
}

/**
 * Select the canonical class partial, failing loudly when the Classes page
 * would reject it for a null class name or year-group key.
 *
 * @remarks
 * The nullable trust fields are read into locals before the guard: the compiler
 * narrows an extracted local, but not the property access on the found row, so
 * checking the properties in place would leave the selected class name typed as
 * nullable and force every consumer to re-assert it.
 *
 * The narrowed row is spread rather than rebuilt because it is served as the
 * `getABClassPartials` payload: every transport field the canonical row carries
 * has to survive, and the Classes page rejects a row missing any of them.
 *
 * @returns {TrustworthyClassPartial} The selected trustworthy class partial.
 */
function selectClassPartial(): TrustworthyClassPartial {
  const selected = classPartials.find((row) => row.classId === SOURCE_LINK_CLASS_ID);
  const className = selected?.className;
  const yearGroupKey = selected?.yearGroupKey;
  if (selected === undefined || className == null || yearGroupKey == null) {
    throw new Error(
      `task-preview-source-link-fixtures: class ${SOURCE_LINK_CLASS_ID} is missing or untrustworthy in the small class partials.`
    );
  }
  return { ...selected, className, yearGroupKey };
}

/** Canonical `class-2` partial row served by `getABClassPartials`. */
export const CANONICAL_CLASS_PARTIAL: TrustworthyClassPartial = selectClassPartial();

/** Canonical `class-2` roster, validated through `ClassFullSchema`. */
export const CANONICAL_CLASS: ClassFull = deepFreeze(
  ClassFullSchema.parse(requireRecord(classesById, SOURCE_LINK_CLASS_ID, 'classesById'))
);

/** Canonical populated Slides assignment, validated through `AssignmentFullSchema`. */
export const CANONICAL_SLIDES_ASSIGNMENT: AssignmentFull = deepFreeze(
  AssignmentFullSchema.parse(
    requireRecord(assignmentsByKey, SLIDES_ASSIGNMENT_ID, 'assignmentsByKey')
  )
);

/** Canonical populated Sheets assignment, validated through `AssignmentFullSchema`. */
export const CANONICAL_SHEETS_ASSIGNMENT: AssignmentFull = deepFreeze(
  AssignmentFullSchema.parse(
    requireRecord(assignmentsByKey, SHEETS_ASSIGNMENT_ID, 'assignmentsByKey')
  )
);

/**
 * Resolve a recent-assignment card title from the definition registry.
 *
 * The Class page renders each recent-assignment card with its definition's
 * `primaryTitle`, so the journey titles are read from the canonical registry
 * rather than restated.
 *
 * @param {AssignmentFull} assignment - The assignment whose card title is needed.
 * @returns {string} The definition title rendered on the recent-assignment card.
 */
function requireDefinitionTitle(assignment: AssignmentFull): string {
  const definitionKey = assignment.assignmentDefinition.definitionKey;
  const definition = definitionPartials.find((row) => row.definitionKey === definitionKey);
  if (definition == null) {
    throw new Error(
      `task-preview-source-link-fixtures: definition ${definitionKey} is absent from the small definition partials.`
    );
  }
  return definition.primaryTitle;
}

/**
 * Derive the year-group reference record the Classes page needs for the
 * canonical class, taking its label from the canonical definition registry.
 *
 * @returns {ReadonlyArray<CanonicalYearGroup>} One year-group reference record.
 */
function selectYearGroups(): ReadonlyArray<CanonicalYearGroup> {
  const yearGroupKey = CANONICAL_CLASS_PARTIAL.yearGroupKey;
  const definition = definitionPartials.find((row) => row.yearGroupKey === yearGroupKey);
  if (definition == null) {
    throw new Error(
      `task-preview-source-link-fixtures: no canonical definition carries year group ${yearGroupKey}.`
    );
  }
  return [{ key: definition.yearGroupKey, name: definition.yearGroupLabel }];
}

/** Canonical year-group reference record used by the Classes page panel. */
export const CANONICAL_YEAR_GROUPS: ReadonlyArray<CanonicalYearGroup> = selectYearGroups();

/** Canonical definition partials view served by the startup warm-up query. */
export const CANONICAL_DEFINITION_PARTIALS: ReadonlyArray<Record<string, unknown>> =
  definitionPartials as unknown as ReadonlyArray<Record<string, unknown>>;

/** Visible class name of the canonical class. */
export const SOURCE_LINK_CLASS_NAME: string = CANONICAL_CLASS_PARTIAL.className;

/** Recent-assignment card title of the canonical Slides assignment. */
export const SLIDES_ASSIGNMENT_TITLE: string = requireDefinitionTitle(CANONICAL_SLIDES_ASSIGNMENT);

/** Heatmaps-builder option label of the canonical Sheets assignment. */
export const SHEETS_ASSIGNMENT_TITLE: string = requireDefinitionTitle(CANONICAL_SHEETS_ASSIGNMENT);

// ---------------------------------------------------------------------------
// Boundary variants
// ---------------------------------------------------------------------------

/** Stored source identifiers overridden on one submission item. */
export type SourceLocationOverride = Readonly<{
  /** Replacement artefact document ID. */
  artifactDocumentId?: string | null;
  /** Replacement artefact page ID. */
  artifactPageId?: string | null;
  /** Replacement parent submission document ID. */
  parentDocumentId?: string | null;
}>;

/**
 * Read the rostered student the walkthroughs read, failing loudly when absent.
 *
 * @param {AssignmentFull} assignment - The assignment to look in.
 * @returns {CanonicalSubmission} The matching submission.
 */
export function selectPrimarySubmission(assignment: AssignmentFull): CanonicalSubmission {
  const primaryStudent = CANONICAL_CLASS.students.at(0);
  if (primaryStudent == null) {
    throw new Error(
      `task-preview-source-link-fixtures: the ${SOURCE_LINK_CLASS_ID} roster carries no students.`
    );
  }
  const submission = assignment.submissions.find((row) => row.studentId === primaryStudent.id);
  if (submission == null) {
    throw new Error(
      `task-preview-source-link-fixtures: student ${primaryStudent.id} has no submission in ${assignment.assignmentId}.`
    );
  }
  return submission;
}

/**
 * Read the lowest-indexed embedded task definition, failing loudly when absent.
 *
 * @param {AssignmentFull} assignment - The assignment to read.
 * @returns {CanonicalTaskDefinition} The matching task definition.
 */
export function selectPrimaryTaskDefinition(assignment: AssignmentFull): CanonicalTaskDefinition {
  // `index` is nullable on the transport task definition; a task without one
  // sorts first so the selection stays deterministic.
  const taskDefinitions = Object.values(assignment.assignmentDefinition.tasks).toSorted(
    (left, right) => (left.index ?? 0) - (right.index ?? 0)
  );
  const taskDefinition = taskDefinitions.at(0);
  if (taskDefinition == null) {
    throw new Error(
      `task-preview-source-link-fixtures: ${assignment.assignmentId} embeds no task definitions.`
    );
  }
  return taskDefinition;
}

/**
 * Apply one stored-source override to a submission and its task item.
 *
 * @param {CanonicalSubmission} submission - The submission to mutate.
 * @param {CanonicalSubmissionItem} item - The task item to mutate.
 * @param {SourceLocationOverride} override - Stored identifiers to replace.
 * @returns {void}
 */
function applySourceLocationOverride(
  submission: CanonicalSubmission,
  item: CanonicalSubmissionItem,
  override: SourceLocationOverride
): void {
  if ('artifactDocumentId' in override) {
    item.artifact.documentId = override.artifactDocumentId ?? null;
  }
  if ('artifactPageId' in override) {
    item.artifact.pageId = override.artifactPageId ?? null;
  }
  if ('parentDocumentId' in override) {
    submission.documentId = override.parentDocumentId ?? null;
  }
}

/**
 * Clone a canonical assignment and override one submission item's stored source
 * identifiers for a narrow boundary case.
 *
 * @param {AssignmentFull} assignment - The canonical assignment to clone.
 * @param {SourceLocationOverride} override - Stored identifiers to replace.
 * @returns {AssignmentFull} A detached assignment carrying the boundary variant.
 */
export function withSourceLocationOverride(
  assignment: AssignmentFull,
  override: SourceLocationOverride
): AssignmentFull {
  const draft = structuredClone(assignment);
  const submission = selectPrimarySubmission(draft);
  const taskId = selectPrimaryTaskDefinition(draft).id;
  const item = submission.items[taskId];
  if (item == null) {
    throw new Error(
      `task-preview-source-link-fixtures: ${submission.studentId} has no item for ${taskId}.`
    );
  }

  applySourceLocationOverride(submission, item, override);
  return AssignmentFullSchema.parse(draft);
}

/**
 * Build the boundary variant whose Sheets artefact carries the numeric gid `"0"`.
 *
 * @returns {AssignmentFull} A detached Sheets assignment using the valid `"0"` tab.
 */
export function withNumericSheetsPageId(): AssignmentFull {
  return withSourceLocationOverride(CANONICAL_SHEETS_ASSIGNMENT, {
    artifactPageId: NUMERIC_SHEETS_PAGE_ID,
  });
}

// ---------------------------------------------------------------------------
// Unsupported artefact content
// ---------------------------------------------------------------------------

/** Artefact bodies the preview card's renderers can display. */
export type SourceLinkBodyKind = 'TEXT' | 'IMAGE' | 'TABLE';

/**
 * The response body each non-TEXT renderer must show.
 *
 * `TEXT` is deliberately absent: a text body's expectation is the canonical
 * artefact content itself, not a constant from another fixture.
 */
const REUSED_UNSUPPORTED_BODY: Readonly<Partial<Record<SourceLinkBodyKind, string>>> = {
  IMAGE: HEATMAP_UNSUPPORTED_ARTIFACT_CONTENT.IMAGE,
  TABLE: HEATMAP_UNSUPPORTED_ARTIFACT_CONTENT.TABLE,
};

/**
 * Clone a canonical assignment and give its primary submission item a body of
 * the requested kind.
 *
 * @remarks
 * The committed synthetic `small` profile ships TEXT-only artefacts, so the
 * image and table renderers can only be reviewed through this recorded local
 * content exception (see `ACTION_PLAN.md`). The record itself is still the
 * canonical one: everything except the displayed artefact's `type` and
 * `content` stays untouched, so the derived source URL, score and accessible
 * label remain canonical.
 *
 * @param {AssignmentFull} assignment - The canonical assignment to clone.
 * @param {SourceLinkBodyKind} bodyKind - Which renderer the preview must exercise.
 * @returns {AssignmentFull} A detached assignment carrying the requested body.
 */
export function withArtifactBody(
  assignment: AssignmentFull,
  bodyKind: SourceLinkBodyKind
): AssignmentFull {
  const draft = structuredClone(assignment);
  if (bodyKind === 'TEXT') {
    return AssignmentFullSchema.parse(draft);
  }

  const content = REUSED_UNSUPPORTED_BODY[bodyKind];
  if (content === undefined) {
    throw new Error(
      `task-preview-source-link-fixtures: no reused local content is available for a ${bodyKind} body.`
    );
  }

  const submission = selectPrimarySubmission(draft);
  const taskId = selectPrimaryTaskDefinition(draft).id;
  const item = submission.items[taskId];
  if (item == null) {
    throw new Error(
      `task-preview-source-link-fixtures: ${submission.studentId} has no item for ${taskId}.`
    );
  }
  item.artifact.type = bodyKind;
  item.artifact.content = content;

  return AssignmentFullSchema.parse(draft);
}
