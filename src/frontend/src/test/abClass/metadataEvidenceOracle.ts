import type {
  AssignmentPartial,
  ClassFull,
  StudentSubmissionItemPartial,
} from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentDefinitionPartial } from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';

type Criterion = 'completeness' | 'accuracy' | 'spag';
type Observation = { item: StudentSubmissionItemPartial; weight: number };

/** Derives a numerical oracle directly from raw evidence, never supplied metadata or production projection.
 * @param {ClassFull} cls - Complete canonical class.
 * @param {AssignmentDefinitionPartial[]} definitions - Live definition evidence.
 * @returns {object} Unrounded standard-weight criterion and overall means.
 */
export function calculateNumericEvidence(
  cls: ClassFull,
  definitions: AssignmentDefinitionPartial[]
) {
  const observations = cls.assignments.flatMap((assignment) =>
    assignmentObservations(assignment, definitions)
  );
  const completeness = criterionMean(observations, 'completeness');
  if (typeof completeness !== 'number')
    throw new TypeError('Canonical numerical oracle requires numeric completeness evidence');
  const accuracy = criterionMean(observations, 'accuracy');
  const spag = criterionMean(observations, 'spag');
  const standardWeights = { completeness: 0.4, accuracy: 0.4, spag: 0.2 };
  const accuracyWeight = typeof accuracy === 'number' ? standardWeights.accuracy : 0;
  const accuracyNumerator = typeof accuracy === 'number' ? accuracy * accuracyWeight : 0;
  const spagWeight = typeof spag === 'number' ? standardWeights.spag : 0;
  const spagNumerator = typeof spag === 'number' ? spag * spagWeight : 0;
  const numerator = completeness * standardWeights.completeness + accuracyNumerator + spagNumerator;
  const overall = numerator / (standardWeights.completeness + accuracyWeight + spagWeight);
  return { completeness, accuracy, spag, overall };
}

/** Resolves raw items and their live weights independently of analyser accumulators.
 * @param {AssignmentPartial} assignment - One instance.
 * @param {AssignmentDefinitionPartial[]} definitions - Live definitions.
 * @returns {Observation[]} Weighted raw observations.
 */
function assignmentObservations(
  assignment: AssignmentPartial,
  definitions: AssignmentDefinitionPartial[]
): Observation[] {
  const definition = definitions.find(
    (entry) => entry.definitionKey === assignment.assignmentDefinitionKey
  );
  if (!definition) throw new Error('Oracle requires a definition for every assignment');
  const items = assignment.submissions.flatMap((submission) => Object.values(submission.items));
  return items.map((item) => {
    const task = definition.tasks.find((entry) => entry.taskId === item.taskId);
    if (!task) throw new Error('Oracle requires a live task for every item');
    return { item, weight: (definition.assignmentWeighting ?? 1) * task.taskWeighting };
  });
}

/** Computes a numeric contribution mean, retaining raw N denominator semantics.
 * @param {Observation[]} observations - Raw evidence.
 * @param {Criterion} criterion - Requested score.
 * @returns {number | 'N' | 'E' | 'excluded'} Expected unrounded mean or evidence state.
 */
function criterionMean(observations: Observation[], criterion: Criterion) {
  const terminal = criterionTerminal(observations, criterion);
  if (terminal !== null) return terminal;
  let numerator = 0;
  let denominator = 0;
  for (const { item, weight } of observations) {
    const score = assessmentScore(item, criterion);
    if (weight <= 0 || !isDenominatorContribution(score, criterion)) continue;
    denominator += weight;
    if (typeof score === 'number') numerator += score * weight;
  }
  return numerator / denominator;
}

/** Resolves non-numeric evidence without borrowing analyser state or projection.
 * @param {Observation[]} observations - Raw evidence with contribution weights.
 * @param {Criterion} criterion - Requested criterion.
 * @returns {'N' | 'E' | 'excluded' | null} Marker, or null when numeric evidence contributes.
 */
function criterionTerminal(observations: Observation[], criterion: Criterion) {
  const scores = observations.map(({ item, weight }) => {
    return {
      score: assessmentScore(item, criterion),
      weight,
    };
  });
  const contributing = scores.filter(({ weight }) => weight > 0);
  if (contributing.some(({ score }) => typeof score === 'number')) return null;
  if (contributing.some(({ score }) => score === 'N')) return 'N';
  return scores.some(({ score }) => score !== undefined) ? 'excluded' : 'E';
}

/** Reads raw criterion evidence, preserving the missing-criterion error distinction.
 * @param {StudentSubmissionItemPartial} item - Source submission item.
 * @param {Criterion} criterion - Requested criterion.
 * @returns {number | 'N' | undefined} Original source score.
 */
function assessmentScore(item: StudentSubmissionItemPartial, criterion: Criterion) {
  return item.assessments?.[criterion]?.score;
}

/** Retains C/A raw N denominator semantics but excludes unavailable SPaG.
 * @param {number | 'N' | undefined} score - Raw source value.
 * @param {Criterion} criterion - Requested criterion.
 * @returns {boolean} Whether this source contributes denominator weight.
 */
function isDenominatorContribution(score: number | 'N' | undefined, criterion: Criterion): boolean {
  return score !== undefined && !(score === 'N' && criterion === 'spag');
}
