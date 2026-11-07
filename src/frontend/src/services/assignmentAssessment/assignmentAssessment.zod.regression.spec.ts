/**
 * Regression tests for the `getAssignment` Zod parse fix.
 *
 * These lock the two real-world backend payload shapes that previously caused
 * `getAssignment` to throw (and the class-page heatmap hover to show
 * "Couldn't load task details"):
 *
 * 1. Unattempted criteria are serialised with `score: 'N'` (a string sentinel,
 *    not a number and not `null`) — see `LLMRequestManager.createNotAttemptedAssessment()`.
 * 2. A submission may omit the `documentId` key entirely (not merely `null`).
 *
 * The unit-level schema behaviour lives in `assignmentAssessment.zod.spec.ts`;
 * this file isolates the regression guards so they are easy to find.
 */

import { describe, expect, it } from 'vitest';
import {
  AssessmentSchema,
  AssignmentFullSchema,
  StudentSubmissionSchema,
} from './assignmentAssessment.zod';
import {
  validBaseArtifact,
  validFullAssignment,
} from '@/test/assignmentAssessment/assignmentAssessment.zod.fixtures';

/**
 * Builds the original regression submission: absent `documentId` key and
 * numeric/'N' criterion scores.
 * @returns {Record<string, unknown>} The regression submission payload.
 */
function regressionSubmission(): Record<string, unknown> {
  const baseSubmission = validFullAssignment.submissions[0];
  return {
    studentId: baseSubmission.studentId,
    studentName: baseSubmission.studentName,
    assignmentId: baseSubmission.assignmentId,
    // documentId key intentionally absent — backend may omit the key entirely
    items: {
      'task-1': {
        id: 'item-1',
        taskId: 'task-1',
        artifact: validBaseArtifact,
        assessments: {
          completeness: { score: 5, reasoning: 'Full coverage' },
          accuracy: { score: 4, reasoning: 'Mostly correct' },
          spag: { score: 'N', reasoning: 'Not applicable' },
        },
        feedback: {},
      },
    },
    createdAt: baseSubmission.createdAt,
    updatedAt: baseSubmission.updatedAt,
  };
}

describe("assignmentAssessment.zod regression (score 'N' / absent documentId)", () => {
  it("accepts an assessment with the 'N' sentinel score (unattempted criterion)", () => {
    const assessment = { score: 'N' as const, reasoning: 'Task not attempted' };
    expect(AssessmentSchema.parse(assessment)).toEqual(assessment);
  });

  it('accepts a submission with documentId omitted entirely (key absent from real backend payload)', () => {
    const submission = {
      studentId: 'student-1',
      studentName: 'Student One',
      assignmentId: 'assign-1',
      // documentId key intentionally absent — real backend omits it
      items: {
        'task-1': {
          id: 'item-1',
          taskId: 'task-1',
          artifact: validBaseArtifact,
          assessments: {},
          feedback: {},
        },
      },
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    };
    expect(StudentSubmissionSchema.parse(submission)).toEqual(submission);
  });

  it("accepts an end-to-end payload with absent documentId and 'N' scores (original regression)", () => {
    const payload = { ...validFullAssignment, submissions: [regressionSubmission()] };
    expect(AssignmentFullSchema.parse(payload)).toEqual(payload);
  });

  it("accepts the original regression payload when the read version marker is 'legacy'", () => {
    const payload = {
      ...validFullAssignment,
      assessmentContractVersion: 'legacy' as const,
      submissions: [regressionSubmission()],
    };
    expect(AssignmentFullSchema.parse(payload)).toEqual(payload);
  });
});
