import { describe, expect, it } from 'vitest';
import { DataAnalysisService } from './dataAnalysisService';
import { AssignmentSummaryAnalyser } from './analysers/assignmentSummaryAnalyser';
import {
  buildInput,
  createAssignmentPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
  createDefinitionPartial,
} from '../../test/dataAnalysis/fixtures';

const ROSTER_SIZE = 5;
const EXPECTED_ACCURACY_AVERAGE = 2;
const ACCURACY_THRESHOLD = 3;
const TIED_TASK_COUNT = 2;

/**
 * Build a minimal boundary case covering numeric, N, error and missing cells.
 * @returns {ReturnType<typeof buildInput>} Minimal valid input.
 */
function buildBoundaryInput() {
  const assignment = createAssignmentPartial({
    assignmentId: 'a_001',
    definitionKey: 'dk_algebra',
    submissions: [
      createSubmission('s_001', 'One', 'a_001', {
        t_001: createSubmissionItem('t_001', {
          completeness: { score: 4 },
          accuracy: { score: 0 },
        }),
      }),
      createSubmission('s_002', 'Two', 'a_001', {
        t_001: createSubmissionItem('t_001', {
          completeness: { score: 3 },
          accuracy: { score: 4 },
        }),
      }),
      createSubmission('s_003', 'Three', 'a_001', {
        t_001: createSubmissionItem('t_001', {
          completeness: { score: 'N' },
          accuracy: { score: 'N' },
        }),
      }),
      createSubmission('s_004', 'Four', 'a_001', {
        t_001: createSubmissionItem('t_001', {}),
      }),
    ],
  });
  return buildInput([
    {
      classId: 'c_001',
      studentIds: ['s_001', 's_002', 's_003', 's_004', 's_005'],
      assignments: [assignment],
    },
  ]);
}

describe('assignment summaries', () => {
  it('counts roster students once, distinguishes missing/error states and includes numeric zero', () => {
    const summary = new DataAnalysisService().analyseAssignmentSummary(
      buildBoundaryInput(),
      'c_001',
      'a_001'
    );
    expect(summary.totalStudents).toBe(ROSTER_SIZE);
    expect(summary.tasks[0]).toMatchObject({
      completedCount: 1,
      belowThresholdCount: 1,
      notAttemptedCount: 2,
      completenessErrorCount: 1,
      incompleteAcrossMostStudents: true,
      accuracyAverage: 2,
      accuracyAssessedCount: 2,
      belowAccuracyThreshold: true,
    });
  });

  it('isolates another assignment using the same definition', () => {
    const input = buildBoundaryInput();
    input.classes[0].assignments.push(
      createAssignmentPartial({
        assignmentId: 'a_002',
        definitionKey: 'dk_algebra',
        submissions: [
          createSubmission('s_001', 'One', 'a_002', {
            t_001: createSubmissionItem('t_001', {
              completeness: { score: 5 },
              accuracy: { score: 5 },
            }),
          }),
        ],
      })
    );
    expect(
      new DataAnalysisService().analyseAssignmentSummary(input, 'c_001', 'a_001').tasks[0]
        .accuracyAverage
    ).toBe(EXPECTED_ACCURACY_AVERAGE);
  });

  it('retains zero-weight scores and does not flag an average exactly at the threshold', () => {
    const input = buildBoundaryInput();
    input.assignmentDefinitionPartials[0].assignmentWeighting = 0;
    input.classes[0].assignments[0].submissions[0].items.t_001.assessments!.accuracy!.score = 2;
    const task = new DataAnalysisService().analyseAssignmentSummary(input, 'c_001', 'a_001')
      .tasks[0];
    expect(task.accuracyAverage).toBe(ACCURACY_THRESHOLD);
    expect(task.belowAccuracyThreshold).toBe(false);
    expect(task.completedCount).toBe(1);
  });

  it('returns no average for no numeric assessments and covers tasks without submissions', () => {
    const input = buildBoundaryInput();
    input.classes[0].assignments[0].submissions = [];
    const summary = new DataAnalysisService().analyseAssignmentSummary(input, 'c_001', 'a_001');
    expect(summary.tasks[0].notAttemptedCount).toBe(ROSTER_SIZE);
    expect(summary.tasks[0].accuracyAverage).toBeNull();
    expect(summary.mostAccurateTaskKeys).toEqual([]);
    expect(summary.leastAccurateTaskKeys).toEqual([]);
  });

  it('handles empty rosters and definitions without tasks', () => {
    const input = buildBoundaryInput();
    input.classes[0].students = [];
    const summary = new DataAnalysisService().analyseAssignmentSummary(input, 'c_001', 'a_001');
    expect(summary.tasks[0].incompleteAcrossMostStudents).toBe(false);
    expect(summary.tasks[0].accuracyAverage).toBeNull();
    input.classes[0].assignments[0].submissions = [];
    input.assignmentDefinitionPartials[0].tasks = [];
    expect(
      new DataAnalysisService().analyseAssignmentSummary(input, 'c_001', 'a_001').tasks
    ).toEqual([]);
  });

  it('retains all ties in highest and lowest accuracy', () => {
    const input = buildBoundaryInput();
    const assignment = input.classes[0].assignments[0];
    assignment.submissions = [
      createSubmission('s_001', 'One', 'a_001', {
        t_001: createSubmissionItem('t_001', { accuracy: { score: 3 } }),
        t_002: createSubmissionItem('t_002', { accuracy: { score: 3 } }),
      }),
    ];
    input.assignmentDefinitionPartials = [
      createDefinitionPartial({
        tasks: [createTaskPartial('t_001'), createTaskPartial('t_002')],
      }),
    ];
    const summary = new DataAnalysisService().analyseAssignmentSummary(input, 'c_001', 'a_001');
    expect(summary.mostAccurateTaskKeys).toHaveLength(TIED_TASK_COUNT);
    expect(summary.leastAccurateTaskKeys).toEqual(summary.mostAccurateTaskKeys);
  });

  it('rejects unknown class, assignment and missing definition', () => {
    const input = buildBoundaryInput();
    const service = new DataAnalysisService();
    expect(() => service.analyseAssignmentSummary(input, 'missing', 'a_001')).toThrow(
      'Unknown summary class'
    );
    expect(() => service.analyseAssignmentSummary(input, 'c_001', 'missing')).toThrow(
      'Unknown summary assignment'
    );
    input.assignmentDefinitionPartials = [];
    expect(() => service.analyseAssignmentSummary(input, 'c_001', 'a_001')).toThrow(
      'Missing summary definition'
    );
  });

  it('does not count assessment errors as proof of incompleteness at the majority boundary', () => {
    const input = buildBoundaryInput();
    input.classes[0].students.pop();
    const summary = new DataAnalysisService().analyseAssignmentSummary(input, 'c_001', 'a_001');
    expect(summary.tasks[0].incompleteAcrossMostStudents).toBe(false);
    expect(summary.tasks[0].completenessErrorCount).toBe(1);
  });

  it('accepts explicit analysis policy and rejects invalid thresholds and source data', () => {
    const input = buildBoundaryInput();
    const analyser = new AssignmentSummaryAnalyser({
      completeness: 3,
      accuracy: 2,
      incompleteProportion: 1,
    });
    const summary = analyser.analyse(input, 'c_001', 'a_001');
    expect(summary.tasks[0].completedCount).toBe(TIED_TASK_COUNT);
    expect(summary.tasks[0].belowAccuracyThreshold).toBe(false);
    expect(
      () =>
        new AssignmentSummaryAnalyser({ completeness: -1, accuracy: 3, incompleteProportion: 0.5 })
    ).toThrow();
    input.filter.classIds = [];
    expect(() =>
      new DataAnalysisService().analyseAssignmentSummary(input, 'c_001', 'a_001')
    ).toThrow();
  });
});
