/**
 * Canonical synthetic `small` fixture selection for the task-preview suites.
 *
 * Selects the shared realistic records — the trustworthy `class-2` roster, its
 * populated Slides `assignment-2-1` and its populated Sheets `assignment-2-2` —
 * from the committed transport views using the frontend raw-JSON import
 * convention, validates every selected full record through its transport
 * schema, and derives the identifiers, labels, metric values and content that
 * the suites assert against. Selected records are deep-frozen, so callers clone
 * them before mutating anything.
 *
 * This module selects from the existing corpus; it is not a second fixture
 * corpus and it never restates realistic labels or content as literals.
 * Deliberately invalid, boundary and state fixtures stay with their owning
 * specs, and the unsupported IMAGE/TABLE/SPREADSHEET submission bodies remain
 * local under the corpus-capability exception recorded in `ACTION_PLAN.md`.
 *
 * @see docs/developer/testing/synthetic-test-data.md
 * @see docs/developer/frontend/frontend-testing.md
 */

import classesByIdRaw from '../../../../../tests/__mocks__/data/synthetic-analysis/small/classesById.json?raw';
import assignmentsByKeyRaw from '../../../../../tests/__mocks__/data/synthetic-analysis/small/assignmentsByKey.json?raw';

import { buildCellPreviewLookup } from '../../features/taskHeatmap/buildCellPreviewLookup';
import type { CellPreviewData } from '../../features/taskHeatmap/buildCellPreviewLookup';
import { AssignmentFullSchema } from '../../services/assignmentAssessment/assignmentAssessment.zod';
import type { AssignmentFull } from '../../services/assignmentAssessment/assignmentAssessment.zod';
import { ClassFullSchema } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import { buildTaskKey } from '../../services/dataAnalysis/taskKey';
import {
  deepFreeze,
  requireRecord,
  requireTextArtifactContent,
  type CanonicalSubmission,
  type CanonicalSubmissionItem,
} from '../shared/canonicalFixturePrimitives';

/** Canonical trustworthy class row selected from the `small` profile. */
const CLASS_ID = 'class-2';

/** Canonical populated Slides assignment owned by {@link CLASS_ID}. */
const SLIDES_ASSIGNMENT_ID = 'assignment-2-1';

/** Canonical populated Sheets assignment owned by {@link CLASS_ID}. */
const SHEETS_ASSIGNMENT_ID = 'assignment-2-2';

/** Canonical task whose submission item backs the ready-preview cell. */
const READY_TASK_ID = 'task-0-0';

/** Array offset that selects the last entry of the canonical class roster. */
const LAST_ROSTER_OFFSET = -1;

const classesById = JSON.parse(classesByIdRaw) as Record<string, unknown>;
const assignmentsByKey = JSON.parse(assignmentsByKeyRaw) as Record<string, unknown>;

/** Canonical `class-2` roster, validated against `ClassFullSchema`. */
export const CANONICAL_CLASS: ClassFull = deepFreeze(
  ClassFullSchema.parse(requireRecord(classesById, CLASS_ID, 'classesById'))
);

/** Canonical populated Slides assignment, validated against `AssignmentFullSchema`. */
export const CANONICAL_SLIDES_ASSIGNMENT: AssignmentFull = deepFreeze(
  AssignmentFullSchema.parse(
    requireRecord(assignmentsByKey, SLIDES_ASSIGNMENT_ID, 'assignmentsByKey')
  )
);

/** Canonical populated Sheets assignment, validated against `AssignmentFullSchema`. */
export const CANONICAL_SHEETS_ASSIGNMENT: AssignmentFull = deepFreeze(
  AssignmentFullSchema.parse(
    requireRecord(assignmentsByKey, SHEETS_ASSIGNMENT_ID, 'assignmentsByKey')
  )
);

/**
 * Identifiers, labels, metric values and content derived from the canonical
 * ready-preview cell, so suites assert against record data rather than
 * restating realistic literals.
 */
export interface CanonicalReadyCell {
  /** Rostered student ID owning the cell. */
  readonly studentId: string;
  /** Display name carried by the canonical roster. */
  readonly studentName: string;
  /** Assignment owning the submission. */
  readonly assignmentId: string;
  /** Embedded definition key used to compose the lookup's inner key. */
  readonly definitionKey: string;
  /** Bare task ID passed to `assembleTaskPreviewData`. */
  readonly taskId: string;
  /** Composite lookup key (`${definitionKey}::${taskId}`). */
  readonly taskKey: string;
  /** Human-readable task title from the embedded definition. */
  readonly taskTitle: string;
  /** Ready TEXT artifact body carried by the canonical submission item. */
  readonly artifactContent: string;
  /** Numeric completeness score assessed for the selected student. */
  readonly completenessScore: number;
  /** Completeness reasoning assessed for the selected student. */
  readonly completenessReasoning: string;
  /** Accuracy reasoning, absent from the corpus and therefore `null`. */
  readonly accuracyReasoning: string | null;
  /** SPaG reasoning assessed for the selected student. */
  readonly spagReasoning: string | null;
}

/**
 * Read one submission for a rostered student, failing loudly when absent.
 *
 * @param {AssignmentFull} assignment - The validated canonical assignment.
 * @param {string} studentId - Student ID the submission must belong to.
 * @returns {CanonicalSubmission} The matching submission.
 */
function requireSubmission(assignment: AssignmentFull, studentId: string): CanonicalSubmission {
  const submission = assignment.submissions.find((candidate) => candidate.studentId === studentId);
  if (submission == null) {
    throw new Error(
      `previewFixtures: student "${studentId}" has no submission in ${assignment.assignmentId}.`
    );
  }
  return submission;
}

/**
 * Read one submission item for a task, failing loudly when absent.
 *
 * @param {CanonicalSubmission} submission - The submission to look in.
 * @param {string} taskId - Task ID the submission item must belong to.
 * @returns {CanonicalSubmissionItem} The matching submission item.
 */
function requireTaskItem(submission: CanonicalSubmission, taskId: string): CanonicalSubmissionItem {
  const item = submission.items[taskId];
  if (item == null) {
    throw new Error(
      `previewFixtures: task "${taskId}" has no submission item for ${submission.studentId}.`
    );
  }
  return item;
}

/**
 * Read one embedded task definition, failing loudly when absent.
 *
 * @param {AssignmentFull} assignment - The validated canonical assignment.
 * @param {string} taskId - Task ID the definition must belong to.
 * @returns {AssignmentFull['assignmentDefinition']['tasks'][string]} The matching definition.
 */
function requireTaskDefinition(
  assignment: AssignmentFull,
  taskId: string
): AssignmentFull['assignmentDefinition']['tasks'][string] {
  const taskDefinition = assignment.assignmentDefinition.tasks[taskId];
  if (taskDefinition == null) {
    throw new Error(
      `previewFixtures: task "${taskId}" is absent from the embedded definition of ${assignment.assignmentId}.`
    );
  }
  return taskDefinition;
}

/**
 * Read the numeric completeness assessment for a submission item.
 *
 * @param {CanonicalSubmissionItem} item - The submission item to assess.
 * @param {string} studentId - Student ID quoted in the failure message.
 * @returns {{ score: number; reasoning: string }} The numeric completeness assessment.
 */
function requireNumericCompleteness(
  item: CanonicalSubmissionItem,
  studentId: string
): { score: number; reasoning: string } {
  const completeness = item.assessments.completeness;
  if (completeness == null || typeof completeness.score !== 'number') {
    throw new Error(
      `previewFixtures: ${studentId} / ${item.taskId} has no numeric completeness score to characterise.`
    );
  }
  return { score: completeness.score, reasoning: completeness.reasoning };
}

/**
 * Select the ready-preview student's ID from the canonical class roster.
 *
 * @remarks
 * The selection is derived from the roster (its last entry) rather than
 * restating a generated student identifier, so a corpus regeneration cannot
 * silently drift away from this fixture. `requireSubmission` and
 * `requireNumericCompleteness` then fail loudly if that rostered student no
 * longer carries the expected submission or numeric score.
 *
 * @param {ClassFull} canonicalClass - The validated canonical class roster.
 * @returns {string} The selected rostered student ID.
 */
function selectReadyStudentId(canonicalClass: ClassFull): string {
  const selectedStudent = canonicalClass.students.at(LAST_ROSTER_OFFSET);
  if (selectedStudent == null) {
    throw new Error(
      `previewFixtures: the canonical ${CLASS_ID} roster carries no students to select a ready cell from.`
    );
  }
  return selectedStudent.id;
}

/**
 * Derive the ready-preview cell selection from the canonical class roster and
 * Slides assignment, failing loudly if the corpus no longer carries the
 * expected student, task or numeric completeness score.
 *
 * @param {ClassFull} canonicalClass - The validated canonical class roster.
 * @param {AssignmentFull} assignment - The validated canonical assignment.
 * @returns {CanonicalReadyCell} The derived ready-cell selection.
 */
function deriveReadyCell(
  canonicalClass: ClassFull,
  assignment: AssignmentFull
): CanonicalReadyCell {
  const submission = requireSubmission(assignment, selectReadyStudentId(canonicalClass));
  const item = requireTaskItem(submission, READY_TASK_ID);
  const taskDefinition = requireTaskDefinition(assignment, item.taskId);
  const completeness = requireNumericCompleteness(item, submission.studentId);

  const definitionKey = assignment.assignmentDefinition.definitionKey;

  return {
    studentId: submission.studentId,
    studentName: submission.studentName,
    assignmentId: assignment.assignmentId,
    definitionKey,
    taskId: item.taskId,
    taskKey: buildTaskKey(definitionKey, item.taskId),
    taskTitle: taskDefinition.taskTitle,
    artifactContent: requireTextArtifactContent(item, submission.studentId),
    completenessScore: completeness.score,
    completenessReasoning: completeness.reasoning,
    accuracyReasoning: item.assessments.accuracy?.reasoning ?? null,
    spagReasoning: item.assessments.spag?.reasoning ?? null,
  };
}

/**
 * Ready-preview cell selection derived from the canonical class roster and
 * {@link CANONICAL_SLIDES_ASSIGNMENT}.
 */
export const CANONICAL_READY_CELL: CanonicalReadyCell = deriveReadyCell(
  CANONICAL_CLASS,
  CANONICAL_SLIDES_ASSIGNMENT
);

/**
 * Clone the canonical Slides assignment so a spec can mutate its submissions,
 * items or artifacts without touching the frozen shared record.
 *
 * @returns {AssignmentFull} A detached copy of the canonical assignment.
 */
export function cloneCanonicalSlidesAssignment(): AssignmentFull {
  return structuredClone(CANONICAL_SLIDES_ASSIGNMENT);
}

/**
 * Clone the canonical Sheets assignment so a spec can mutate its submissions,
 * items or artifacts without touching the frozen shared record.
 *
 * @returns {AssignmentFull} A detached copy of the canonical assignment.
 */
export function cloneCanonicalSheetsAssignment(): AssignmentFull {
  return structuredClone(CANONICAL_SHEETS_ASSIGNMENT);
}

/**
 * Build the ready cell's `CellPreviewData` through the production lookup, so
 * the characterisation specs receive exactly what `buildCellPreviewLookup`
 * derives from the canonical submission item.
 *
 * @returns {CellPreviewData} The derived ready-preview cell data.
 */
export function buildCanonicalReadyCellData(): CellPreviewData {
  const lookup = buildCellPreviewLookup(cloneCanonicalSlidesAssignment());
  const cellData = lookup.get(CANONICAL_READY_CELL.studentId)?.get(CANONICAL_READY_CELL.taskKey);
  if (cellData == null) {
    throw new Error(
      `previewFixtures: no cell preview data for ${CANONICAL_READY_CELL.studentId} / ${CANONICAL_READY_CELL.taskKey}.`
    );
  }
  return cellData;
}
