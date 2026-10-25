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
 * specs, and unsupported TABLE submission bodies remain local under the
 * capability notes in the synthetic test-data guide.
 *
 * @see docs/developer/testing/synthetic-test-data.md
 * @see docs/developer/frontend/frontend-testing.md
 */

import classesByIdRaw from '@synthetic/small/classesById.json?raw';
import assignmentsByKeyRaw from '@synthetic/small/assignmentsByKey.json?raw';

import { buildCellPreviewLookup } from '@/features/taskHeatmap/buildCellPreviewLookup';
import type { CellPreviewData } from '@/features/taskHeatmap/buildCellPreviewLookup';
import { AssignmentFullSchema } from '@/services/assignmentAssessment/assignmentAssessment.zod';
import type { AssignmentFull } from '@/services/assignmentAssessment/assignmentAssessment.zod';
import { ClassFullSchema } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { buildTaskKey } from '@/services/dataAnalysis/taskKey';
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
  readonly studentName: string | null;
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
  /** Accuracy reasoning assessed for the selected student. */
  readonly accuracyReasoning: string;
  /** SPaG reasoning assessed for the selected student. */
  readonly spagReasoning: string | null;
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
 * Read required accuracy reasoning from a completed canonical item.
 * @param {CanonicalSubmissionItem} item - The submission item to assess.
 * @param {string} studentId - Student ID quoted in the failure message.
 * @returns {string} The numeric accuracy assessment reasoning.
 */
function requireAccuracyReasoning(item: CanonicalSubmissionItem, studentId: string): string {
  const accuracy = item.assessments.accuracy;
  if (accuracy == null || typeof accuracy.score !== 'number') {
    throw new Error(
      `previewFixtures: ${studentId} / ${item.taskId} has no numeric accuracy score to characterise.`
    );
  }
  return accuracy.reasoning;
}

/**
 * Select the canonical ready submission by its linked, healthy TEXT record.
 *
 * @remarks
 * Candidate assignments come from the selected class's assignment links;
 * candidates must belong to its roster and have a TEXT body/hash, numeric
 * completeness and accuracy, and a matching embedded task identity.
 *
 * @param {ClassFull} canonicalClass - The validated canonical class roster.
 * @param {Record<string, unknown>} assignments - Parsed canonical full-assignment view.
 * @returns {{ assignment: AssignmentFull; submission: CanonicalSubmission }} The healthy linked pair.
 */
function selectReadySubmission(
  canonicalClass: ClassFull,
  assignments: Record<string, unknown>
): { assignment: AssignmentFull; submission: CanonicalSubmission } {
  const rosterIds = new Set(canonicalClass.students.map(({ id }) => id));
  const linkedAssignments = canonicalClass.assignments.flatMap(({ assignmentId }) => {
    const rawAssignment = assignments[assignmentId];
    if (rawAssignment == null) return [];
    const assignment = AssignmentFullSchema.parse(rawAssignment);
    const linked = canonicalClass.assignments.find(
      (row) => row.assignmentId === assignment.assignmentId
    );
    if (linked?.assignmentDefinitionKey !== assignment.assignmentDefinition.definitionKey)
      return [];
    return [assignment];
  });

  for (const assignment of linkedAssignments) {
    const item = assignment.submissions
      .filter((submission) => rosterIds.has(submission.studentId))
      .map((submission) => ({ submission, item: submission.items[READY_TASK_ID] }))
      .find(({ item }) => isHealthyTextItem(item));
    if (item != null) {
      const taskDefinition = assignment.assignmentDefinition.tasks[READY_TASK_ID];
      if (taskDefinition == null || item.item.taskId !== READY_TASK_ID) {
        throw new Error(
          `previewFixtures: canonical ${assignment.assignmentId} has no matching ${READY_TASK_ID} definition/item identity.`
        );
      }
      return { assignment, submission: item.submission };
    }
  }
  throw new Error(
    `previewFixtures: no healthy linked TEXT submission for ${READY_TASK_ID} exists in the canonical ${CLASS_ID} graph.`
  );
}

/**
 * Check source usability and numeric result completeness for the chosen task.
 * @param {CanonicalSubmissionItem | undefined} item - Candidate task item.
 * @returns {boolean} Whether the item satisfies the healthy TEXT contract.
 */
function isHealthyTextItem(item: CanonicalSubmissionItem | undefined): boolean {
  return item?.taskId === READY_TASK_ID && hasUsableTextSource(item) && hasNumericCoreMarks(item);
}

/**
 * Check that a TEXT artifact carries its source body and hash.
 * @param {CanonicalSubmissionItem} item - Candidate item.
 * @returns {boolean} Whether its source body and hash are usable.
 */
function hasUsableTextSource(item: CanonicalSubmissionItem): boolean {
  return (
    item.artifact.type === 'TEXT' &&
    typeof item.artifact.content === 'string' &&
    typeof item.artifact.contentHash === 'string'
  );
}

/**
 * Check that both required numeric criteria are present.
 * @param {CanonicalSubmissionItem} item - Candidate item.
 * @returns {boolean} Whether completeness and accuracy are numeric.
 */
function hasNumericCoreMarks(item: CanonicalSubmissionItem): boolean {
  return (
    typeof item.assessments.completeness?.score === 'number' &&
    typeof item.assessments.accuracy?.score === 'number'
  );
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
  const { assignment: selectedAssignment, submission } = selectReadySubmission(
    canonicalClass,
    assignmentsByKey
  );
  if (selectedAssignment.assignmentId !== assignment.assignmentId) {
    throw new Error(
      `previewFixtures: selected canonical assignment ${selectedAssignment.assignmentId} does not match ${assignment.assignmentId}.`
    );
  }
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
    accuracyReasoning: requireAccuracyReasoning(item, submission.studentId),
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
