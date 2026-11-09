/**
 * Standalone legacy-analysis parity oracle: canonical fixture access, analyser
 * input building and observation collection.
 *
 * The parity suites derive expected analysis numbers from these observations
 * through the sibling `legacyAssessmentParityExpectations` aggregators instead
 * of restating literals or analyser outputs.
 */

import smallClassesRaw from '@synthetic/small/classesById.json?raw';
import smallDefinitionPartialsRaw from '@synthetic/small/assignmentDefinitionPartials.json?raw';
import {
  AveragingAnalyserInputSchema,
  type AveragingAnalyserInput,
} from '@/services/dataAnalysis/dataAnalysis.zod';

/** Analysis criterion names. */
export type Criterion = 'completeness' | 'accuracy' | 'spag';

/** Canonical score union: numeric, not-attempted, or error. */
type Score = number | 'N' | 'E';

const CLASS_ID = 'class-2';

/** The class-embedded assignment the parity suites mark `'legacy'`. */
export const LEGACY_ASSIGNMENT_ID = 'assignment-2-1';

/** Definition key of {@link LEGACY_ASSIGNMENT_ID}. */
export const LEGACY_DEFINITION_KEY = 'definition-0-slides';

/** Task identifiers of {@link LEGACY_ASSIGNMENT_ID}. */
export const LEGACY_TASK_IDS = ['task-0-0', 'task-0-1'] as const;

const classesById = JSON.parse(smallClassesRaw) as Record<string, RawRecord>;
const definitionPartials = JSON.parse(smallDefinitionPartialsRaw) as Array<{
  definitionKey: string;
  assignmentWeighting: number | null;
  tasks: Array<{ taskId: string; taskWeighting: number }>;
}>;

type RawRecord = Record<string, unknown>;

/**
 * Reads one roster identifier from the canonical class.
 * @param {number} index - Roster position.
 * @returns {string} The student identifier at that position.
 */
export function rosterStudentId(index: number): string {
  const cls = classesById[CLASS_ID] as { students: Array<{ id: string }> };
  const student = cls.students[index];
  if (!student) throw new Error(`Canonical roster entry ${index} is missing`);
  return student.id;
}

/**
 * Counts the canonical class roster.
 * @returns {number} Number of rostered students.
 */
export function rosterSize(): number {
  const cls = classesById[CLASS_ID] as { students: Array<{ id: string }> };
  return cls.students.length;
}

/**
 * Builds the analyser input for the canonical class with only the selected
 * assignment's marker changed: the legacy variant flips it to `'legacy'` while
 * every other assignment keeps its canonical marker 1.
 * @param {boolean} isLegacy - Whether the selected assignment is marked `'legacy'`.
 * @returns {AveragingAnalyserInput} Validated analyser input.
 */
export function buildClassInput(isLegacy: boolean): AveragingAnalyserInput {
  const cls = structuredClone(classesById[CLASS_ID]) as {
    assignments: Array<RawRecord & { assignmentId: string; assessmentContractVersion: unknown }>;
  };
  const assignment = cls.assignments.find((entry) => entry.assignmentId === LEGACY_ASSIGNMENT_ID);
  if (!assignment) throw new Error('Canonical class-2 assignment is missing');
  if (isLegacy) assignment.assessmentContractVersion = 'legacy';
  return AveragingAnalyserInputSchema.parse({
    filter: { classIds: [CLASS_ID], analysisMode: 'absolute' },
    classes: [cls],
    assignmentDefinitionPartials: structuredClone(definitionPartials),
  });
}

/** One criterion observation: canonical score and live effective weight. */
export interface Observation {
  score: Score;
  effectiveWeight: number;
}

/** Expected metric values derived from the canonical records. */
export interface AggregateExpectation {
  state: 'computed' | 'notAttempted' | 'error';
  value: number | 'N' | 'E';
  totalWeight: number;
  applicableDataPoints: number;
  totalDataPoints: number;
}

/**
 * Resolves one task's effective weight from the live definition partial
 * registry, mirroring the nullable assignment-weight normalisation.
 * @param {AveragingAnalyserInput} input - Validated analyser input.
 * @param {string} definitionKey - Assignment definition identifier.
 * @param {string} taskId - Task identifier.
 * @returns {number} assignmentWeighting × taskWeighting.
 */
export function effectiveWeightFor(
  input: AveragingAnalyserInput,
  definitionKey: string,
  taskId: string
): number {
  const partial = input.assignmentDefinitionPartials.find(
    (entry) => entry.definitionKey === definitionKey
  );
  if (!partial) throw new Error(`Definition partial ${definitionKey} is missing`);
  const task = partial.tasks.find((entry) => entry.taskId === taskId);
  if (!task) throw new Error(`Task ${taskId} is missing from ${definitionKey}`);
  return (partial.assignmentWeighting ?? 1) * task.taskWeighting;
}

/**
 * Reports whether an observation position passes the selection filter.
 * @param {object} select - Optional assignment/task/student selectors.
 * @param {string} [select.assignmentId] - Assignment to keep.
 * @param {string} [select.taskId] - Task to keep.
 * @param {string} [select.studentId] - Student to keep.
 * @param {string} assignmentId - Observed assignment identifier.
 * @param {string} taskId - Observed task identifier.
 * @param {string} studentId - Observed student identifier.
 * @returns {boolean} Whether the observation is selected.
 */
function isSelectedObservation(
  select: { assignmentId?: string; taskId?: string; studentId?: string },
  assignmentId: string,
  taskId: string,
  studentId: string
): boolean {
  return (
    (select.assignmentId === undefined || select.assignmentId === assignmentId) &&
    (select.taskId === undefined || select.taskId === taskId) &&
    (select.studentId === undefined || select.studentId === studentId)
  );
}

/**
 * Converts one canonical item into an oracle observation.
 * @param {AveragingAnalyserInput} input - Validated analyser input.
 * @param {Criterion} criterion - Criterion to collect.
 * @param {AveragingAnalyserInput['classes'][number]['assignments'][number]} assignment - Owning assignment.
 * @param {string} taskId - Item's task identifier.
 * @param {AveragingAnalyserInput['classes'][number]['assignments'][number]['submissions'][number]['items'][string]} item - Candidate item.
 * @returns {Observation} Score and effective-weight pair.
 */
function toObservation(
  input: AveragingAnalyserInput,
  criterion: Criterion,
  assignment: AveragingAnalyserInput['classes'][number]['assignments'][number],
  taskId: string,
  item: AveragingAnalyserInput['classes'][number]['assignments'][number]['submissions'][number]['items'][string]
): Observation {
  const result = item.assessments?.[criterion];
  if (!result) throw new Error(`Expected a ${criterion} result for task ${taskId}`);
  return {
    score: result.score,
    effectiveWeight: effectiveWeightFor(input, assignment.assignmentDefinitionKey, taskId),
  };
}

/**
 * Collects one criterion's observations by walking the input's canonical
 * records, independent of the analyser.
 * @param {AveragingAnalyserInput} input - Validated analyser input.
 * @param {Criterion} criterion - Criterion to collect.
 * @param {object} [select] - Optional assignment/task/student selectors.
 * @param {string} [select.assignmentId] - Assignment to keep.
 * @param {string} [select.taskId] - Task to keep.
 * @param {string} [select.studentId] - Student to keep.
 * @returns {Observation[]} Score and effective-weight pairs.
 */
export function collectObservations(
  input: AveragingAnalyserInput,
  criterion: Criterion,
  select: { assignmentId?: string; taskId?: string; studentId?: string } = {}
): Observation[] {
  const cls = input.classes[0];
  if (!cls) throw new Error('Expected the canonical class');
  return cls.assignments.flatMap((assignment) => {
    return assignment.submissions.flatMap((submission) => {
      return Object.entries(submission.items)
        .filter(([taskId]) =>
          isSelectedObservation(select, assignment.assignmentId, taskId, submission.studentId)
        )
        .map(([taskId, item]) => toObservation(input, criterion, assignment, taskId, item));
    });
  });
}

/**
 * Reads one criterion score from the input's canonical records.
 * @param {AveragingAnalyserInput} input - Validated analyser input.
 * @param {string} assignmentId - Assignment identifier.
 * @param {string} taskId - Task identifier.
 * @param {string} studentId - Student identifier.
 * @param {Criterion} criterion - Criterion to read.
 * @returns {number | 'N' | 'E'} The recorded score.
 */
export function canonicalItemScore(
  input: AveragingAnalyserInput,
  assignmentId: string,
  taskId: string,
  studentId: string,
  criterion: Criterion
): Score {
  const cls = input.classes[0];
  if (!cls) throw new Error('Expected the canonical class');
  const assignment = cls.assignments.find((entry) => entry.assignmentId === assignmentId);
  if (!assignment) throw new Error(`Expected assignment ${assignmentId}`);
  const submission = assignment.submissions.find((entry) => entry.studentId === studentId);
  if (!submission) throw new Error(`Expected a submission for ${studentId}`);
  const item = submission.items[taskId];
  if (!item) throw new Error(`Expected an item for task ${taskId}`);
  const result = item.assessments?.[criterion];
  if (!result) throw new Error(`Expected a ${criterion} result for task ${taskId}`);
  return result.score;
}
