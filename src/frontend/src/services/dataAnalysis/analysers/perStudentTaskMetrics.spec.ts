import { describe, it, expect } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import {
  buildInput,
  createAssignmentPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '../../../test/dataAnalysis/fixtures';

// ---------------------------------------------------------------------------
// perStudentTaskMetrics — conversion from perStudentTaskAccums to the typed
// array on AveragingResult.
// ---------------------------------------------------------------------------

describe('perStudentTaskMetrics conversion', () => {
  it('yields one entry per (studentId, taskKey) with classId echoed from the input class', () => {
    const input = buildInput([
      {
        classId: 'c_001',
        className: 'Test Class',
        studentIds: ['s_001', 's_002'],
        assignments: [
          createAssignmentPartial({
            assignmentId: 'a_001',
            definitionKey: 'dk_algebra',
            tasks: [createTaskPartial('t_001')],
            submissions: [
              createSubmission('s_001', 'Alice', 'a_001', {
                t_001: createSubmissionItem('t_001', {
                  completeness: { score: 5 },
                  accuracy: { score: 4 },
                  spag: { score: 3 },
                }),
              }),
              createSubmission('s_002', 'Bob', 'a_001', {
                t_001: createSubmissionItem('t_001', {
                  completeness: { score: 3 },
                  accuracy: { score: 5 },
                  spag: { score: 4 },
                }),
              }),
            ],
          }),
        ],
      },
    ]);

    const analyser = new AveragingAnalyser();
    const results = analyser.analyse(input);

    expect(results).toHaveLength(1);

    const result = results[0] as unknown as {
      perStudentTaskMetrics?: Array<Record<string, unknown>>;
    };

    const expectedEntryCount = 2; // Two students, one task each

    expect(result.perStudentTaskMetrics).toBeDefined();
    expect(result.perStudentTaskMetrics).toHaveLength(expectedEntryCount);

    // Each entry carries the classId from the input class
    for (const entry of result.perStudentTaskMetrics!) {
      expect(entry.classId).toBe('c_001');
      expect(entry.taskKey).toBe('dk_algebra::t_001');
    }

    // Student identifiers are present
    const studentIds = result.perStudentTaskMetrics!.map(
      (m: Record<string, unknown>) => m.studentId
    );
    expect(studentIds).toContain('s_001');
    expect(studentIds).toContain('s_002');
  });

  it('populates completeness, accuracy, spag, and overall via accumToMetric for that scope', () => {
    const input = buildInput([
      {
        classId: 'c_001',
        className: 'Test Class',
        studentIds: ['s_001'],
        assignments: [
          createAssignmentPartial({
            assignmentId: 'a_001',
            definitionKey: 'dk_algebra',
            tasks: [createTaskPartial('t_001')],
            submissions: [
              createSubmission('s_001', 'Alice', 'a_001', {
                t_001: createSubmissionItem('t_001', {
                  completeness: { score: 5 },
                  accuracy: { score: 4 },
                  spag: { score: 3 },
                }),
              }),
            ],
          }),
        ],
      },
    ]);

    const analyser = new AveragingAnalyser();
    const results = analyser.analyse(input);

    const result = results[0] as unknown as {
      perStudentTaskMetrics?: Array<Record<string, unknown>>;
    };

    const expectedEntryCount = 1; // Single student, single task
    const expectedCompleteness = 5;
    const expectedAccuracy = 4;
    const expectedSpag = 3;
    const expectedOverall = 4.2;

    expect(result.perStudentTaskMetrics).toBeDefined();
    expect(result.perStudentTaskMetrics).toHaveLength(expectedEntryCount);

    const entry = result.perStudentTaskMetrics![0];
    expect(entry.completeness).toMatchObject({ state: 'computed' });
    expect((entry.completeness as Record<string, unknown>).value).toBe(expectedCompleteness);
    expect(entry.accuracy).toMatchObject({ state: 'computed' });
    expect((entry.accuracy as Record<string, unknown>).value).toBe(expectedAccuracy);
    expect(entry.spag).toMatchObject({ state: 'computed' });
    expect((entry.spag as Record<string, unknown>).value).toBe(expectedSpag);
    // overall is a composite computed score
    expect(entry.overall).toMatchObject({ state: 'computed' });
    expect((entry.overall as Record<string, unknown>).value).toBe(expectedOverall);
  });

  it('produces one entry per (student, taskKey) across multiple tasks and students', () => {
    const input = buildInput([
      {
        classId: 'c_001',
        className: 'Test Class',
        studentIds: ['s_001'],
        assignments: [
          createAssignmentPartial({
            assignmentId: 'a_001',
            definitionKey: 'dk_physics',
            tasks: [createTaskPartial('t_001'), createTaskPartial('t_002')],
            submissions: [
              createSubmission('s_001', 'Alice', 'a_001', {
                t_001: createSubmissionItem('t_001', {
                  completeness: { score: 5 },
                  accuracy: { score: 4 },
                  spag: { score: 3 },
                }),
                t_002: createSubmissionItem('t_002', {
                  completeness: { score: 2 },
                  accuracy: { score: 3 },
                  spag: { score: 4 },
                }),
              }),
            ],
          }),
        ],
      },
    ]);

    const analyser = new AveragingAnalyser();
    const results = analyser.analyse(input);

    const result = results[0] as unknown as {
      perStudentTaskMetrics?: Array<Record<string, unknown>>;
    };

    const expectedEntryCount = 2; // One student × two tasks
    const expectedT001Completeness = 5;
    const expectedT002Completeness = 2;

    expect(result.perStudentTaskMetrics).toBeDefined();
    expect(result.perStudentTaskMetrics).toHaveLength(expectedEntryCount);

    const t001Entry = result.perStudentTaskMetrics!.find(
      (m: Record<string, unknown>) => m.taskKey === 'dk_physics::t_001'
    );
    const t002Entry = result.perStudentTaskMetrics!.find(
      (m: Record<string, unknown>) => m.taskKey === 'dk_physics::t_002'
    );
    expect(t001Entry).toBeDefined();
    expect(t002Entry).toBeDefined();
    expect((t001Entry!.completeness as Record<string, unknown>).value).toBe(
      expectedT001Completeness
    );
    expect((t002Entry!.completeness as Record<string, unknown>).value).toBe(
      expectedT002Completeness
    );

    // Both entries have the same classId
    expect(t001Entry!.classId).toBe('c_001');
    expect(t002Entry!.classId).toBe('c_001');

    // Both belong to the same student
    expect(t001Entry!.studentId).toBe('s_001');
    expect(t002Entry!.studentId).toBe('s_001');
  });
});
