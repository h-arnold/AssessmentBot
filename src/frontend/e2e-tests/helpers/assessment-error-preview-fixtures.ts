/**
 * Canonical `medium` fixture selection for the assessment-error preview browser
 * journeys.
 *
 * @remarks
 * Selects the trustworthy `class-2` roster, its populated assignment instances
 * and the live definition partials from the committed `medium` transport views
 * using the Node-side direct-JSON-import convention already used by
 * `task-preview-source-link-fixtures.ts`, and validates every selected full
 * record through its real transport schema. It then owns the boundary variants
 * the error journeys need: a preview-only corrupt item, marker-only legacy full
 * and class results that retain their saved scores and content, an explicit
 * stored `REASSESSMENT_REQUIRED` record, and a known class-partial `E` whose full
 * read is still pending or has failed.
 *
 * Every variant is a detached clone of a validated record, so the committed
 * fixtures are never mutated. No derived preview state (reasoning, source URL,
 * `sourceState`) is placed in a mocked API payload: the journeys assert what the
 * browser derives from the stored record.
 *
 * Scenario construction, navigation and locators live in the sibling
 * `assessment-error-preview-journeys.ts`, which also re-exports this module's
 * public surface.
 *
 * @see docs/developer/testing/synthetic-test-data.md
 * @see docs/developer/frontend/frontend-playwright-e2e.md
 */

import {
  AssignmentFullSchema,
  type AssignmentFull,
} from '@/services/assignmentAssessment/assignmentAssessment.zod';
import {
  ClassFullSchema,
  type ClassFull,
} from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { deepFreeze, requireRecord } from '@/test/shared/canonicalFixturePrimitives';
import assignmentsByKeyRaw from '@synthetic/medium/assignmentsByKey.json';
import classesByIdRaw from '@synthetic/medium/classesById.json';
import classPartialsRaw from '@synthetic/medium/classPartials.json';
import definitionPartialsRaw from '@synthetic/medium/assignmentDefinitionPartials.json';

// ---------------------------------------------------------------------------
// Canonical selection
// ---------------------------------------------------------------------------

/** Canonical class every journey opens. */
const ERROR_CLASS_ID = 'class-2';

/**
 * First selected merged instance: the populated instance whose submission
 * carries the partial `E`.
 */
export const SHARED_FIRST_ASSIGNMENT_ID = 'assignment-2-4';

/**
 * Second selected merged instance of the same definition, with no submission for
 * the `E` student.
 */
export const SHARED_SECOND_ASSIGNMENT_ID = 'assignment-2-0';

/**
 * Assignments the Class page prefetches once its surface is ready, newest first.
 *
 * @remarks
 * `useClassPageAssignmentPrefetch` warms the three newest assignments in
 * `updatedAt` order, so those reads consume the head of the `getAssignment`
 * queue. The embedded heatmap's own preview read for one of those assignments
 * shares the same query key and is therefore a cache hit, not a new request.
 */
export const CLASS_PAGE_PREFETCH_ASSIGNMENT_IDS: ReadonlyArray<string> = [
  'assignment-2-5',
  'assignment-2-4',
  'assignment-2-3',
];

/** Task every preview journey reads. */
export const JOURNEY_TASK_ID = 'task-0-0';

/** Student whose submission mixes a healthy sibling with an assessment `E`. */
export const MIXED_STUDENT_ID = '100000000020000000001';

/** Catalogue reasoning of an assessment-stage failure. */
export const ASSESSMENT_FAILED_REASONING = 'The extracted work could not be assessed.';

/** Catalogue reasoning of an acquisition-stage failure. */
export const SOURCE_UNREADABLE_REASONING = 'The submitted document could not be accessed.';

/** Catalogue reasoning of a legacy reassessment result. */
export const LEGACY_ASSESSMENT_REASONING = 'Reassessment required';

/** Catalogue reasoning of a validation corruption result. */
export const CORRUPT_RECORD_REASONING =
  'The stored assessment data for this task is invalid. Reassess the assignment.';

/** Alert title of every unavailable source region. */
export { SOURCE_UNAVAILABLE_TITLE as UNAVAILABLE_TITLE } from '@/features/taskHeatmap/TaskPreviewCard';

/** Alert copy for a full-read-only corrupt record. */
export { SOURCE_CORRUPTION_DESCRIPTION as CORRUPTION_DESCRIPTION } from '@/features/taskHeatmap/TaskPreviewCard';

/** Alert copy for a legacy reassessment result. */
export { REASSESSMENT_DESCRIPTION as REASSESSMENT_COPY } from '@/features/taskHeatmap/TaskPreviewCard';

const assignmentsByKey = assignmentsByKeyRaw as unknown as Record<string, unknown>;
const classesById = classesByIdRaw as unknown as Record<string, unknown>;
const classPartials = classPartialsRaw as unknown as ReadonlyArray<Record<string, unknown>>;
const definitionPartials = definitionPartialsRaw as unknown as ReadonlyArray<
  Record<string, unknown>
>;

/**
 * Read one canonical assignment and validate it through its transport schema.
 * @param {string} assignmentId - Canonical assignment identity.
 * @returns {AssignmentFull} The validated, frozen record.
 */
export function canonicalAssignment(assignmentId: string): AssignmentFull {
  return deepFreeze(
    AssignmentFullSchema.parse(requireRecord(assignmentsByKey, assignmentId, 'assignmentsByKey'))
  );
}

/** Canonical `class-2` roster and partial assignment summaries. */
export const CANONICAL_CLASS: ClassFull = deepFreeze(
  ClassFullSchema.parse(requireRecord(classesById, ERROR_CLASS_ID, 'classesById'))
);

/**
 * Select the canonical class partial, failing loudly when it cannot key a card.
 * @returns {Record<string, unknown>} The selected partial row.
 */
function selectClassPartial(): Record<string, unknown> {
  const selected = classPartials.find((row) => row.classId === ERROR_CLASS_ID);
  if (selected === undefined) {
    throw new Error(`assessment-error-preview-fixtures: ${ERROR_CLASS_ID} has no class partial.`);
  }
  return selected;
}

/** Canonical class partial row served by `getABClassPartials`. */
export const CANONICAL_CLASS_PARTIAL: Record<string, unknown> = selectClassPartial();

/** Canonical definition registry served by `getAssignmentDefinitionPartials`. */
export const CANONICAL_DEFINITION_PARTIALS: ReadonlyArray<Record<string, unknown>> =
  definitionPartials;

/** Visible class name of the canonical class. */
export const ERROR_CLASS_NAME: string = String(CANONICAL_CLASS_PARTIAL.className);

/**
 * Resolve the definition title the Classes page renders for one assignment.
 * @param {string} assignmentId - Assignment identity.
 * @returns {string} The rendered Recent Assignments card title.
 */
export function assignmentCardTitle(assignmentId: string): string {
  const assignment = CANONICAL_CLASS.assignments.find(
    (candidate) => candidate.assignmentId === assignmentId
  );
  if (assignment === undefined) {
    throw new Error(`assessment-error-preview-fixtures: ${assignmentId} is not in the class.`);
  }
  const partial = definitionPartials.find(
    (row) => row.definitionKey === assignment.assignmentDefinitionKey
  );
  const title = partial?.primaryTitle;
  if (typeof title !== 'string') {
    throw new TypeError(
      `assessment-error-preview-fixtures: ${assignment.assignmentDefinitionKey} has no title.`
    );
  }
  return title;
}

/**
 * Derive the year-group reference record the Classes page needs.
 * @returns {ReadonlyArray<{ key: string; name: string }>} One year-group record.
 */
function selectYearGroups(): ReadonlyArray<{ key: string; name: string }> {
  const yearGroupKey = CANONICAL_CLASS_PARTIAL.yearGroupKey;
  const partial = definitionPartials.find((row) => row.yearGroupKey === yearGroupKey);
  if (typeof partial?.yearGroupLabel !== 'string') {
    throw new TypeError(
      `assessment-error-preview-fixtures: no definition carries year group ${String(yearGroupKey)}.`
    );
  }
  return [{ key: String(yearGroupKey), name: partial.yearGroupLabel }];
}

/** Year-group reference record the Classes page needs for the canonical class. */
export const CANONICAL_YEAR_GROUPS: ReadonlyArray<{ key: string; name: string }> =
  selectYearGroups();

// ---------------------------------------------------------------------------
// Controlled variants
// ---------------------------------------------------------------------------

/**
 * Read one submission item, failing loudly when the fixture drifts.
 * @param {AssignmentFull} assignment - The assignment to read.
 * @param {string} studentId - Submission owner.
 * @param {string} taskId - Task identity.
 * @returns {AssignmentFull['submissions'][number]['items'][string]} The item.
 */
function requireItem(
  assignment: AssignmentFull,
  studentId: string,
  taskId: string
): AssignmentFull['submissions'][number]['items'][string] {
  const submission = assignment.submissions.find((row) => row.studentId === studentId);
  const item = submission?.items[taskId];
  if (item === undefined) {
    throw new Error(
      `assessment-error-preview-fixtures: ${assignment.assignmentId} has no ${studentId}/${taskId} item.`
    );
  }
  return item;
}

/**
 * Clone a canonical assignment and remove one criterion from one item.
 *
 * @remarks
 * The served payload is what a corrupt stored record looks like after the
 * backend has written it: the criterion map is no longer the exact three-key
 * map, so the read normaliser isolates that item as a validation
 * `CORRUPT_RECORD` E while every sibling item and class score stays untouched.
 *
 * @param {string} assignmentId - Canonical assignment identity.
 * @param {string} studentId - Submission owner.
 * @param {string} taskId - Task identity.
 * @param {'completeness' | 'accuracy' | 'spag'} criterion - Criterion to drop.
 * @returns {Record<string, unknown>} The corrupted wire payload.
 */
export function withMissingCriterion(
  assignmentId: string,
  studentId: string,
  taskId: string,
  criterion: 'completeness' | 'accuracy' | 'spag'
): Record<string, unknown> {
  const draft = structuredClone(canonicalAssignment(assignmentId));
  const item = requireItem(draft, studentId, taskId);
  delete (item.assessments as Record<string, unknown>)[criterion];
  return draft as unknown as Record<string, unknown>;
}

/**
 * Clone a canonical assignment and mark it as a legacy read result.
 *
 * @remarks
 * The stored record has no `assessmentContractVersion`; a legacy read returns
 * `'legacy'` with its saved scores, reasoning, artefacts and feedback intact.
 * Only the marker changes, so the served payload is the canonical content the
 * read contract must preserve rather than a blanket reassessment placeholder.
 *
 * @param {string} assignmentId - Canonical assignment identity.
 * @returns {Record<string, unknown>} The legacy full-read payload.
 */
export function withLegacyAssignment(assignmentId: string): Record<string, unknown> {
  const draft = structuredClone(canonicalAssignment(assignmentId));
  const payload = draft as unknown as Record<string, unknown>;
  payload.assessmentContractVersion = 'legacy';
  return payload;
}

/**
 * Clone the canonical class and mark one embedded assignment as legacy.
 *
 * @remarks
 * The class snapshot carries the same saved results as the full read, so only
 * the selected assignment's marker changes. Every sibling assignment keeps `1`.
 *
 * @param {string} assignmentId - Assignment instance to mark legacy.
 * @returns {Record<string, unknown>} The class wire payload with one legacy assignment.
 */
export function withLegacyClassAssignment(assignmentId: string): Record<string, unknown> {
  const draft = structuredClone(CANONICAL_CLASS) as unknown as Record<string, unknown>;
  const assignments = draft.assignments as Array<Record<string, unknown>>;
  const target = assignments.find((row) => row.assignmentId === assignmentId);
  if (target === undefined) {
    throw new Error(`assessment-error-preview-fixtures: ${assignmentId} is not in the class.`);
  }
  target.assessmentContractVersion = 'legacy';
  return draft;
}

/**
 * Clone a canonical assignment and store an explicit `REASSESSMENT_REQUIRED` E.
 *
 * @remarks
 * This is a current-format record whose saved items carry the explicit
 * validation error the old projector produced. It proves the preview still
 * supports previously stored reassessment results; the assignment marker stays
 * `1`, so the legacy status tag is not involved.
 *
 * @param {string} assignmentId - Canonical assignment identity.
 * @returns {Record<string, unknown>} The stored-error wire payload.
 */
export function withStoredReassessmentError(assignmentId: string): Record<string, unknown> {
  const draft = structuredClone(canonicalAssignment(assignmentId));
  for (const submission of draft.submissions) {
    for (const item of Object.values(submission.items)) {
      const reassessment = {
        score: 'E' as const,
        reasoning: LEGACY_ASSESSMENT_REASONING,
        error: { stage: 'validation' as const, code: 'REASSESSMENT_REQUIRED' as const },
      };
      item.assessments = {
        completeness: { ...reassessment },
        accuracy: { ...reassessment },
        spag: { ...reassessment },
      };
    }
  }
  return draft as unknown as Record<string, unknown>;
}

/**
 * Clone the canonical class and give one assignment a known class-partial E.
 *
 * @remarks
 * The class snapshot is the only source of a known result while an assignment's
 * own full read is pending or has failed, so the E has to be present here for
 * those journeys. The full read stays current, which is what a real
 * class-partial/full-read disagreement looks like.
 *
 * @param {string} assignmentId - Assignment instance to downgrade.
 * @returns {Record<string, unknown>} The class wire payload carrying the E.
 */
export function withClassPartialAssessmentError(assignmentId: string): Record<string, unknown> {
  const draft = structuredClone(CANONICAL_CLASS) as unknown as Record<string, unknown>;
  const assignments = draft.assignments as Array<Record<string, unknown>>;
  const target = assignments.find((row) => row.assignmentId === assignmentId);
  if (target === undefined) {
    throw new Error(`assessment-error-preview-fixtures: ${assignmentId} is not in the class.`);
  }
  for (const submission of target.submissions as Array<Record<string, unknown>>) {
    for (const item of Object.values(submission.items as Record<string, Record<string, unknown>>)) {
      const assessmentError = {
        score: 'E',
        reasoning: ASSESSMENT_FAILED_REASONING,
        error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
      };
      item.assessments = {
        completeness: { ...assessmentError },
        accuracy: { ...assessmentError },
        spag: { ...assessmentError },
      };
    }
  }
  return draft;
}
