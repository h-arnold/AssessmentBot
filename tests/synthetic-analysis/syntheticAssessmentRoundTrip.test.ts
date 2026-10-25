import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';

const { callApiMock } = await vi.hoisted(() => ({ callApiMock: vi.fn() }));

type GeneratedAssessment = { score: number | 'N' | 'E'; reasoning?: string; error?: unknown };
type GeneratedItem = {
  assessments: Record<string, GeneratedAssessment>;
  artifact: { content: unknown; contentHash: unknown };
};
type GeneratedSubmission = { items: Record<string, GeneratedItem> };
type GeneratedAssignment = {
  courseId: string;
  assignmentId: string;
  assessmentContractVersion?: number;
  submissions: GeneratedSubmission[];
};
type GeneratedGraphWithAssignments = {
  transport: { assignmentsByKey: Record<string, GeneratedAssignment> };
};

function hasAssignmentsByKey(graph: object): graph is GeneratedGraphWithAssignments {
  if (!('transport' in graph) || typeof graph.transport !== 'object' || graph.transport === null) {
    return false;
  }
  return (
    'assignmentsByKey' in graph.transport &&
    typeof graph.transport.assignmentsByKey === 'object' &&
    graph.transport.assignmentsByKey !== null
  );
}

vi.mock('@/services/apiService', async (importOriginal) => {
  const actual = await importOriginal();
  if (typeof actual !== 'object' || actual === null)
    throw new Error('API module must be an object');
  return { ...actual, callApi: callApiMock };
});

const PROFILE = 'small';
const generatedSmall = generateSyntheticAnalysisGraph(PROFILE);
if (!hasAssignmentsByKey(generatedSmall)) {
  throw new Error('Generated assignmentsByKey must be an object');
}
const fullRows = Object.values(generatedSmall.transport.assignmentsByKey);
const canonicalFull = fullRows.find((assignment) =>
  assignment.submissions.some((submission) =>
    Object.values(submission.items).some((item) =>
      Object.values(item.assessments).some((result) => result.score === 'E')
    )
  )
);
if (!canonicalFull)
  throw new Error('Small profile must include a full assignment with an E result');

describe('canonical synthetic assessment round trips', () => {
  afterEach(() => {
    callApiMock.mockReset();
    vi.resetModules();
  });

  it('preserves current marker, complete results, E cause and usable source through Assignment serialization', () => {
    const assignment = (globalThis as any).Assignment.fromJSON(structuredClone(canonicalFull));
    const serialised = assignment.toJSON();
    expect(serialised.assessmentContractVersion).toBe(1);

    const [submission] = serialised.submissions.filter((row: any) =>
      Object.values(row.items).some((item: any) =>
        Object.values(item.assessments).some((result: any) => result.score === 'E')
      )
    );
    expect(submission).toBeDefined();
    for (const item of Object.values(submission.items) as any[]) {
      expect(Object.keys(item.assessments).sort()).toEqual(['accuracy', 'completeness', 'spag']);
      expect(item.artifact.content).not.toBeNull();
      expect(item.artifact.contentHash).toEqual(expect.any(String));
    }
    const error = Object.values(submission.items as Record<string, any>)
      .flatMap((item) => Object.values(item.assessments))
      .find((result: any) => result.score === 'E') as any;
    expect(error.reasoning).toEqual(expect.any(String));
    expect(error.error).toMatchObject({ stage: 'assessment', code: 'ASSESSMENT_FAILED' });
  });

  it('runs the real getAssignment service schema and parser on a canonical full wire response', async () => {
    const payload = structuredClone(canonicalFull);
    callApiMock.mockImplementation(() => Promise.resolve(payload));
    const { getAssignment } =
      await import('@/services/assignmentAssessment/assignmentAssessmentService');

    const result = await getAssignment({
      courseId: payload.courseId,
      assignmentId: payload.assignmentId,
    });

    expect(callApiMock).toHaveBeenCalledTimes(1);
    expect(callApiMock).toHaveBeenCalledWith('getAssignment', {
      courseId: payload.courseId,
      assignmentId: payload.assignmentId,
    });
    expect(result).toEqual(payload);
    expect(result?.assessmentContractVersion).toBe(1);
    const allResults = result!.submissions.flatMap((submission) =>
      Object.values(submission.items).flatMap((item) => Object.values(item.assessments))
    );
    expect(allResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          score: 'E',
          error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
        }),
      ])
    );
  });
});
