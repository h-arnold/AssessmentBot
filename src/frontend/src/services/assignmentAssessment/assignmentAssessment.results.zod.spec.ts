import { describe, expect, it } from 'vitest';
import {
  AssessmentSchema,
  AssignmentFullSchema,
  StudentSubmissionItemSchema,
} from './assignmentAssessment.zod';

const boundaryArtifact = {
  taskId: 'task-1',
  role: 'submission',
  pageId: null,
  documentId: null,
  uid: 'uid-1',
  type: 'base',
  content: null,
  contentHash: null,
  metadata: {},
};
const UNSUPPORTED_MARKERS = [0, '1'] as const;

describe('assignment assessment result schemas', () => {
  it('accepts a valid assessment with score and reasoning', () => {
    const assessment = { score: 3, reasoning: 'good work' };
    expect(AssessmentSchema.parse(assessment)).toEqual(assessment);
  });

  it('rejects a non-catalogue string score', () => {
    expect(() => AssessmentSchema.parse({ score: 'three', reasoning: 'ok' })).toThrow();
  });

  it('rejects an assessment with missing reasoning', () => {
    expect(() => AssessmentSchema.parse({ score: 3 })).toThrow();
  });

  it("rejects a null score (contract: only number | 'N' | 'E' allowed)", () => {
    expect(() => AssessmentSchema.parse({ score: null, reasoning: 'pending' })).toThrow();
  });

  it('rejects unknown result fields under the strict assessment contract', () => {
    const assessment = { score: 3, reasoning: 'good', extra: 'field' };
    expect(AssessmentSchema.safeParse(assessment).success).toBe(false);
  });

  it('accepts valid assessment results on an item', () => {
    const item = {
      id: 'item-1',
      taskId: 'task-1',
      artifact: boundaryArtifact,
      assessments: { clarity: { score: 3, reasoning: 'good' } },
      feedback: {},
    };
    expect(StudentSubmissionItemSchema.parse(item)).toEqual(item);
  });

  it('rejects an item assessment whose score is the invalid numeric string "3"', () => {
    expect(() => {
      return StudentSubmissionItemSchema.parse({
        id: 'item-1',
        taskId: 'task-1',
        artifact: boundaryArtifact,
        assessments: { clarity: { score: '3', reasoning: 'good' } },
        feedback: {},
      });
    }).toThrow();
  });

  it('accepts numeric, fractional, N and complete E results in a canonical full assignment', async () => {
    const { validFullAssignment } =
      await import('@/test/assignmentAssessment/assignmentAssessment.zod.fixtures');
    expect(AssignmentFullSchema.parse(validFullAssignment)).toEqual(validFullAssignment);
    const candidate = structuredClone(validFullAssignment);
    const submission = candidate.submissions[0];
    const item = Object.values(submission.items)[0];
    item.assessments = {
      completeness: { score: 2.5, reasoning: 'Fractional result' },
      accuracy: { score: 'N', reasoning: 'Not applicable' },
      spag: {
        score: 'E',
        reasoning: 'The assessment could not be completed.',
        error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
      },
    };
    expect(AssignmentFullSchema.parse(candidate)).toEqual(candidate);
  });

  it('requires marker 1 or null at the full-assignment consumer boundary', async () => {
    const { validFullAssignment } =
      await import('@/test/assignmentAssessment/assignmentAssessment.zod.fixtures');
    for (const marker of [1, null] as const) {
      const candidate = { ...validFullAssignment, assessmentContractVersion: marker };
      expect(AssignmentFullSchema.safeParse(candidate).success).toBe(true);
    }
    const markerless = { ...validFullAssignment };
    delete (markerless as Record<string, unknown>).assessmentContractVersion;
    expect(AssignmentFullSchema.safeParse(markerless).success).toBe(false);
    for (const unsupported of UNSUPPORTED_MARKERS) {
      expect(
        AssignmentFullSchema.safeParse({
          ...validFullAssignment,
          assessmentContractVersion: unsupported,
        }).success
      ).toBe(false);
    }
  });
});
