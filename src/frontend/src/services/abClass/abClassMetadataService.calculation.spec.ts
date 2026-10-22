import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataAnalysisService } from '../dataAnalysis/dataAnalysisService';
import type { AveragingAnalyserInput } from '../dataAnalysis/dataAnalysis.zod';
import {
  calculateExpectedScores,
  createMetadataRefreshFixture,
  newestAssignment,
  PROFILES,
  SUMMARY_TIME,
} from '@/test/abClass/metadataRefreshFixtures';
import { installMetadataRefreshTransport } from '@/test/abClass/metadataRefreshTransport';
import { refreshABClassMetadata } from '../dataAnalysis/postAnalysis/refreshABClassMetadata';
import { calculateNumericEvidence } from '@/test/abClass/metadataEvidenceOracle';

const TWO_ANALYSES = 2;
const MAX_SCORE = 5;
const INSTANCE_MEAN = 3;
const NUMERIC_PRECISION = 12;
const PERCENT_SCALE = 100;

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ABClass metadata calculation and exact replacement', () => {
  it.each(['N', 'E', 'excluded'] as const)(
    'persists calculated %s metrics, never marker-to-zero conversion',
    async (state) => {
      const context = createMetadataRefreshFixture('small');
      context.classFull.metadata = null;
      const submissions = context.classFull.assignments.flatMap(
        (assignment) => assignment.submissions
      );
      const items = submissions.flatMap((submission) => Object.values(submission.items));
      expect(items.length).toBeGreaterThan(0);
      items.forEach((item) => {
        item.assessments =
          state === 'E'
            ? {}
            : { completeness: { score: 'N' }, accuracy: { score: 'N' }, spag: { score: 'N' } };
      });
      if (state === 'excluded')
        context.assignmentDefinitionPartials.forEach((definition) => {
          definition.assignmentWeighting = 0;
        });
      // Isolate a populated instance so the recent-entry marker is evidenced too.
      context.classFull.assignments = context.classFull.assignments.filter((assignment) =>
        assignment.submissions.some((submission) => Object.keys(submission.items).length > 0)
      );
      const backend = installMetadataRefreshTransport(context.classFull);

      await refreshABClassMetadata(context, () => SUMMARY_TIME);

      const scores = { completeness: state, accuracy: state, spag: state, overall: state };
      expect(backend.readStored()!.metadata!.classAverages).toEqual({
        ...scores,
        updatedAt: SUMMARY_TIME,
      });
      expect(backend.readStored()!.metadata!.recentAssignments[0].averages).toEqual(scores);
    }
  );

  it.each(PROFILES)(
    'calculates full scope and exactly one newest instance using standard weights (%s)',
    async (profile) => {
      const context = createMetadataRefreshFixture(profile);
      context.classFull.metadata = null;
      const target = newestAssignment(context.classFull);
      const expectedClass = calculateExpectedScores(context, context.classFull);
      const expectedAssignment = calculateExpectedScores(context, {
        ...context.classFull,
        assignments: [target],
      });
      const backend = installMetadataRefreshTransport(context.classFull);
      const before = structuredClone(context);
      const calculate = vi.spyOn(DataAnalysisService.prototype, 'analyse');
      const now = vi.fn(() => SUMMARY_TIME);

      const result = await refreshABClassMetadata(context, now);

      expect(result).toMatchObject({
        status: 'saved',
        confirmedPersistence: true,
        classPartial: { classId: context.classFull.classId },
      });
      expect(calculate).toHaveBeenCalledTimes(TWO_ANALYSES);
      const inputs = calculate.mock.calls.map(([input]) => input);
      expect(
        inputs.map((input: AveragingAnalyserInput) =>
          input.classes[0].assignments.map((assignment) => assignment.assignmentId)
        )
      ).toEqual([
        context.classFull.assignments.map((assignment) => assignment.assignmentId),
        [target.assignmentId],
      ]);
      for (const input of inputs) {
        expect(input.filter).toEqual({ classIds: [context.classFull.classId] });
        expect(input.assignmentDefinitionPartials).toEqual(context.assignmentDefinitionPartials);
      }
      expect(backend.requests).toEqual([
        { method: 'getABClass', params: { classId: context.classFull.classId } },
        {
          method: 'updateABClass',
          params: {
            classId: context.classFull.classId,
            metadata: {
              classAverages: { ...expectedClass, updatedAt: SUMMARY_TIME },
              recentAssignments: [
                {
                  assignmentId: target.assignmentId,
                  assignmentDefinitionKey: target.assignmentDefinitionKey,
                  averages: expectedAssignment,
                  updatedAt: target.updatedAt,
                },
              ],
            },
          },
        },
      ]);
      if (result.status !== 'saved') throw new Error('Expected confirmed persistence');
      expect(result.classPartial.metadata).toEqual(backend.readStored()!.metadata);
      expect(now).toHaveBeenCalledTimes(1);
      expect(context).toEqual(before);
    }
  );

  it('does not reuse filtered/custom-weight display results as a complete class snapshot', async () => {
    const context = createMetadataRefreshFixture('small');
    context.classFull.metadata = null;
    const expected = calculateExpectedScores(context, context.classFull);
    context.averagingResult = new DataAnalysisService().analyse({
      classes: [{ ...context.classFull, assignments: [context.classFull.assignments[0]] }],
      assignmentDefinitionPartials: context.assignmentDefinitionPartials,
      filter: {
        classIds: [context.classFull.classId],
        criterionWeightings: { completeness: 1, accuracy: 0, spag: 0 },
      },
    })[0];
    const backend = installMetadataRefreshTransport(context.classFull);
    const calculate = vi.spyOn(DataAnalysisService.prototype, 'analyse');

    await refreshABClassMetadata(context, () => SUMMARY_TIME);

    expect(backend.readStored()!.metadata!.classAverages).toEqual({
      ...expected,
      updatedAt: SUMMARY_TIME,
    });
    expect(calculate.mock.calls[0][0].filter).toEqual({ classIds: [context.classFull.classId] });
    expect(calculate.mock.results[0].value[0].appliedCriterionWeightings).toEqual({
      completeness: 0.4,
      accuracy: 0.4,
      spag: 0.2,
    });
  });

  it('requires definitions for every fresh assignment, not merely the selected target', async () => {
    const context = createMetadataRefreshFixture('small');
    context.classFull.metadata = null;
    const target = newestAssignment(context.classFull);
    const missing = context.classFull.assignments.find(
      (assignment) => assignment.assignmentDefinitionKey !== target.assignmentDefinitionKey
    )!;
    expect(missing).toBeDefined();
    context.assignmentDefinitionPartials = context.assignmentDefinitionPartials.filter(
      (definition) => definition.definitionKey !== missing.assignmentDefinitionKey
    );
    const backend = installMetadataRefreshTransport(context.classFull);
    const calculate = vi.spyOn(DataAnalysisService.prototype, 'analyse');
    const now = vi.fn(() => SUMMARY_TIME);

    await expect(refreshABClassMetadata(context, now)).rejects.toThrow(
      missing.assignmentDefinitionKey
    );
    expect(backend.events).toEqual(['getABClass']);
    expect(calculate).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });

  it('isolates repeated-definition assignment instances rather than aggregating their task identities', async () => {
    const context = createMetadataRefreshFixture('small');
    const source = context.classFull.assignments.find((assignment) =>
      assignment.submissions.some((submission) => Object.keys(submission.items).length > 0)
    )!;
    expect(source).toBeDefined();
    const first = structuredClone(source);
    const second = structuredClone(source);
    second.assignmentId = `${first.assignmentId}-reassessment`;
    second.updatedAt = SUMMARY_TIME;
    for (const [assignment, score] of [
      [first, 1],
      [second, MAX_SCORE],
    ] as const) {
      for (const submission of assignment.submissions) {
        submission.assignmentId = assignment.assignmentId;
        for (const item of Object.values(submission.items))
          item.assessments = { completeness: { score }, accuracy: { score }, spag: { score } };
      }
    }
    context.classFull.assignments = [first, second];
    context.classFull.metadata = null;
    const backend = installMetadataRefreshTransport(context.classFull);
    const calculate = vi.spyOn(DataAnalysisService.prototype, 'analyse');

    await refreshABClassMetadata(context, () => SUMMARY_TIME);

    const saved = backend.readStored()!.metadata!;
    expect(saved.recentAssignments).toHaveLength(1);
    expect(saved.recentAssignments[0]).toMatchObject({
      assignmentId: second.assignmentId,
      assignmentDefinitionKey: first.assignmentDefinitionKey,
      averages: { completeness: 5, accuracy: 5, spag: 5, overall: 5 },
    });
    expect(saved.classAverages.completeness).toBe(INSTANCE_MEAN);
    expect(calculate.mock.calls[1][0].classes[0].assignments).toHaveLength(1);
  });

  it('retains raw canonical evidence precision and weighted overall, not a mean of task displays', async () => {
    const context = createMetadataRefreshFixture('medium');
    context.classFull.metadata = null;
    const expected = calculateNumericEvidence(
      context.classFull,
      context.assignmentDefinitionPartials
    );
    expect(Number.isFinite(expected.overall)).toBe(true);
    const backend = installMetadataRefreshTransport(context.classFull);

    await refreshABClassMetadata(context, () => SUMMARY_TIME);

    if (typeof expected.spag !== 'number') throw new TypeError('Expected full-class numeric SPaG');
    const saved = backend.readStored()!.metadata!.classAverages;
    expect(saved.completeness).toBeCloseTo(expected.completeness, NUMERIC_PRECISION);
    expect(saved.accuracy).toEqual(expected.accuracy);
    expect(saved.spag).toBeCloseTo(expected.spag, NUMERIC_PRECISION);
    expect(saved.overall).toBeCloseTo(expected.overall, NUMERIC_PRECISION);
    expect(saved.overall).not.toBe(Math.round(expected.overall * PERCENT_SCALE) / PERCENT_SCALE);
  });
});
