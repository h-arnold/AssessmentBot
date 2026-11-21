/**
 * ClassSummary local-boundary contract: baseline unavailability, arbitrary
 * collaborator-error propagation and the `convertToBaselineExcluded` path for
 * isolated assignments with no baseline metrics.
 *
 * These inputs are small algorithmic-boundary fixtures, not corpus data; the
 * realistic derivation contract is covered by `classSummaryAnalyser.spec.ts`
 * against the canonical `medium` view. Shared medium-input and score-derivation
 * helpers come from `test/dataAnalysis/classSummaryFixtures.ts`, the single home
 * for these fixtures; a change there is visible in both sibling specs.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClassSummaryAnalyser } from './classSummaryAnalyser';
import { AveragingAnalyser } from './analysers/averagingAnalyser';
import { AveragingAnalyserInputSchema, type AveragingAnalyserInput } from './dataAnalysis.zod';
import {
  buildInput,
  createAssignmentPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '@/test/dataAnalysis/fixtures';
import {
  analyseSummary,
  buildMediumInput,
  buildSummaryOptions,
  expectedBaselineScores,
  isolatedAbsoluteResult,
  projectMetrics,
} from '@/test/dataAnalysis/classSummaryFixtures';

/** Number of recent assignments passed to the multi-assignment boundary cases. */
const RECENT_ASSIGNMENT_COUNT = 3;

/** Constructed score for the top-attempting local fixture students. */
const TOP_LOCAL_SCORE = 5;

/** Constructed score for the middle local fixture students. */
const MID_LOCAL_SCORE = 4;

/** Constructed score for the low-attempting local fixture student. */
const LOW_LOCAL_SCORE = 3;

/**
 * Build a local below-minimum-roster input (algorithmic-boundary probe).
 *
 * @returns {AveragingAnalyserInput} The validated two-student input.
 */
function buildBelowMinimumRosterInput(): AveragingAnalyserInput {
  const assignment = createAssignmentPartial({
    assignmentId: 'a_local',
    definitionKey: 'dk_local',
    tasks: [createTaskPartial('t_001')],
    submissions: [
      createSubmission('s_001', 'Alice', 'a_local', {
        t_001: createSubmissionItem('t_001', {
          completeness: { score: 4 },
          accuracy: { score: 4 },
        }),
      }),
      createSubmission('s_002', 'Bob', 'a_local', {
        t_001: createSubmissionItem('t_001', {
          completeness: { score: 3 },
          accuracy: { score: 3 },
        }),
      }),
    ],
  });
  return buildInput(
    [
      {
        classId: 'c_local',
        className: 'Local Class',
        studentIds: ['s_001', 's_002'],
        assignments: [assignment],
      },
    ],
    { filter: { classIds: ['c_local'], analysisMode: 'absolute' } }
  );
}

/**
 * Build a local empty-intersection input (algorithmic-boundary probe).
 *
 * @returns {AveragingAnalyserInput} The validated disjoint-attempt input.
 */
function buildEmptyIntersectionInput(): AveragingAnalyserInput {
  const assignment = createAssignmentPartial({
    assignmentId: 'a_disjoint',
    definitionKey: 'dk_disjoint',
    tasks: [createTaskPartial('t_001'), createTaskPartial('t_002')],
    submissions: [
      createSubmission('s_001', 'Alice', 'a_disjoint', {
        t_001: createSubmissionItem('t_001', { completeness: { score: 5 } }),
      }),
      createSubmission('s_002', 'Bob', 'a_disjoint', {
        t_002: createSubmissionItem('t_002', { completeness: { score: 4 } }),
      }),
    ],
  });
  return buildInput(
    [
      {
        classId: 'c_disjoint',
        className: 'Disjoint Class',
        studentIds: ['s_001', 's_002', 's_003'],
        assignments: [assignment],
      },
    ],
    { filter: { classIds: ['c_disjoint'], analysisMode: 'absolute' } }
  );
}

/**
 * Build a submission item for a local boundary fixture.
 *
 * @param {string} taskId - The task identifier.
 * @param {number} score - The shared criterion score.
 * @returns {ReturnType<typeof createSubmissionItem>} The submission item.
 */
function createBoundaryItem(
  taskId: string,
  score: number
): ReturnType<typeof createSubmissionItem> {
  return createSubmissionItem(taskId, {
    completeness: { score },
    accuracy: { score },
    spag: { score },
  });
}

/**
 * Build a local input where a rankable student has no baseline metrics in the
 * newest assignment (algorithmic-boundary probe, not corpus data).
 *
 * @returns {AveragingAnalyserInput} The validated two-assignment input.
 */
function buildNoBaselineMetricsInOneAssignmentInput(): AveragingAnalyserInput {
  const tasks = [
    createTaskPartial('t_001'),
    createTaskPartial('t_002'),
    createTaskPartial('t_003'),
  ];
  const older = createAssignmentPartial({
    assignmentId: 'a_1',
    definitionKey: 'dk_local',
    tasks,
    submissions: [
      createSubmission('s_001', 'Alice', 'a_1', {
        t_001: createBoundaryItem('t_001', TOP_LOCAL_SCORE),
        t_002: createBoundaryItem('t_002', TOP_LOCAL_SCORE),
      }),
      createSubmission('s_002', 'Bob', 'a_1', {
        t_001: createBoundaryItem('t_001', MID_LOCAL_SCORE),
        t_002: createBoundaryItem('t_002', MID_LOCAL_SCORE),
      }),
      createSubmission('s_003', 'Carol', 'a_1', {
        t_001: createBoundaryItem('t_001', LOW_LOCAL_SCORE),
      }),
    ],
  });
  const newest = createAssignmentPartial({
    assignmentId: 'a_2',
    definitionKey: 'dk_local',
    tasks,
    submissions: [
      createSubmission('s_001', 'Alice', 'a_2', {
        t_001: createBoundaryItem('t_001', TOP_LOCAL_SCORE),
        t_002: createBoundaryItem('t_002', TOP_LOCAL_SCORE),
      }),
      createSubmission('s_002', 'Bob', 'a_2', {
        t_001: createBoundaryItem('t_001', MID_LOCAL_SCORE),
        t_002: createBoundaryItem('t_002', MID_LOCAL_SCORE),
      }),
      createSubmission('s_003', 'Carol', 'a_2', {
        t_003: createBoundaryItem('t_003', LOW_LOCAL_SCORE),
      }),
    ],
  });

  const input = buildInput([
    {
      classId: 'c_local2',
      className: 'Local Boundary Class',
      studentIds: ['s_001', 's_002', 's_003'],
      assignments: [older, newest],
    },
  ]);
  input.classes[0].assignments[0].updatedAt = '2026-01-01T00:00:00.000Z';
  input.classes[0].assignments[1].updatedAt = '2026-01-02T00:00:00.000Z';
  return AveragingAnalyserInputSchema.parse(input);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ClassSummaryAnalyser — baseline metric exclusion for isolated assignments', () => {
  it('converts a rankable student with no baseline metrics in one assignment to excluded criteria and composite overall', () => {
    // Algorithmic-boundary probe (local, not corpus): the whole-class baseline
    // is {t_001, t_002}; Carol is rankable via t_001 in the older assignment but
    // attempts only outside-baseline t_003 in the newest one, so that one
    // isolated assignment must follow the convertToBaselineExcluded path.
    const input = buildNoBaselineMetricsInOneAssignmentInput();
    const options = buildSummaryOptions(input, RECENT_ASSIGNMENT_COUNT);
    const summary = analyseSummary(input, options);

    const baselineResult = new AveragingAnalyser().analyse({
      ...input,
      filter: { ...input.filter, analysisMode: 'topDecileBaseline' },
    })[0];
    if (!baselineResult.attemptBaseline) {
      throw new Error('local three-student fixture must be baseline-eligible');
    }
    const baselineKeys = new Set(baselineResult.attemptBaseline.baselineTaskKeys);
    expect([...baselineKeys].toSorted((a, b) => a.localeCompare(b))).toEqual([
      'dk_local::t_001',
      'dk_local::t_002',
    ]);
    if (!summary.baseline.standings) {
      throw new Error('available baseline summary must carry standings');
    }

    const carol = [...summary.baseline.standings.top, ...summary.baseline.standings.bottom].find(
      (entry) => entry.studentId === 's_003'
    );
    if (!carol) throw new Error('rankable Carol must appear in the baseline standings');
    const newestIndex = options.recentAssignments.findIndex(
      (assignment) => assignment.assignmentId === 'a_2'
    );
    expect(newestIndex).toBe(0);

    const scores = carol.recentAssignmentScores[newestIndex];
    expect(scores.completeness.state).toBe('excluded');
    expect(scores.accuracy.state).toBe('excluded');
    expect(scores.spag.state).toBe('excluded');
    expect(scores.overall.state).toBe('excluded');
    expect(scores).toEqual(
      expectedBaselineScores(input, baselineKeys, options.recentAssignments[newestIndex], 's_003')
    );
  });
});

describe('ClassSummaryAnalyser — baseline unavailability and error propagation', () => {
  it('reports available: false with null baseline fields while keeping all-task fields and target', () => {
    const input = buildBelowMinimumRosterInput();
    const options = buildSummaryOptions(input, RECENT_ASSIGNMENT_COUNT);
    const summary = analyseSummary(input, options);

    expect(summary.baseline).toEqual({
      available: false,
      classAverages: null,
      standings: null,
    });
    expect(summary.allTasks.classAverages).toEqual(
      new AveragingAnalyser().analyse(input)[0].perClass
    );
    expect(
      summary.allTasks.standings.top.length + summary.allTasks.standings.bottom.length
    ).toBeGreaterThan(0);
    expect(summary.target.averages).toEqual(
      projectMetrics(isolatedAbsoluteResult(input, options.target).perClass)
    );
  });

  it('reports available: false for an empty pool intersection', () => {
    const input = buildEmptyIntersectionInput();
    const options = buildSummaryOptions(input, RECENT_ASSIGNMENT_COUNT);
    const summary = analyseSummary(input, options);

    expect(summary.baseline).toEqual({
      available: false,
      classAverages: null,
      standings: null,
    });
    expect(summary.allTasks.classAverages).toEqual(
      new AveragingAnalyser().analyse(input)[0].perClass
    );
  });

  it('propagates an arbitrary collaborator error unchanged without broad catching or message matching', () => {
    const input = buildMediumInput('absolute');
    const options = buildSummaryOptions(input, RECENT_ASSIGNMENT_COUNT);
    const arbitraryError = new Error('unexpected averaging failure');
    vi.spyOn(AveragingAnalyser.prototype, 'analyse').mockImplementation(() => {
      throw arbitraryError;
    });

    let thrown: unknown;
    try {
      new ClassSummaryAnalyser().analyse(input, options);
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBe(arbitraryError);
  });
});

describe('ClassSummaryAnalyser — all-tasks basis selection', () => {
  it('keeps allTasks on the absolute basis when the caller supplies a baseline-mode input', () => {
    const input = buildMediumInput('topDecileBaseline');
    const options = buildSummaryOptions(input, RECENT_ASSIGNMENT_COUNT);
    const summary = analyseSummary(input, options);

    const absoluteResult = new AveragingAnalyser().analyse(buildMediumInput('absolute'))[0];
    const baselineResult = new AveragingAnalyser().analyse(input)[0];

    // The two bases must differ on this fixture, otherwise the assertions below
    // cannot distinguish an absolute allTasks basis from a baseline one.
    expect(baselineResult.perClass).not.toEqual(absoluteResult.perClass);

    expect(summary.allTasks.classAverages).toEqual(projectMetrics(absoluteResult.perClass));
    expect(summary.allTasks.classAverages).not.toEqual(projectMetrics(baselineResult.perClass));

    // A baseline-mode input must not confuse the separate baseline fields.
    expect(summary.baseline.available).toBe(true);
    expect(summary.baseline.classAverages).toEqual(projectMetrics(baselineResult.perClass));
    if (!summary.baseline.standings) {
      throw new Error('available baseline summary must carry standings');
    }
    expect(
      summary.baseline.standings.top.length + summary.baseline.standings.bottom.length
    ).toBeGreaterThan(0);
  });
});
