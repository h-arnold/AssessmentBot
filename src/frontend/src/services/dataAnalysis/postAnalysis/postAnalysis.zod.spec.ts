import { describe, expect, it } from 'vitest';
import { createMetadataRefreshFixture } from '@/test/abClass/metadataRefreshFixtures';
import { PostAnalysisContextSchema, PostAnalysisTaskOutcomeDataSchema } from './postAnalysis.zod';

describe('PostAnalysisContextSchema', () => {
  it('retains successful averaging, the complete class and live definitions as detached data', () => {
    const context = createMetadataRefreshFixture('small');
    const parsed = PostAnalysisContextSchema.parse(context);
    expect(parsed).toEqual(context);
    expect(parsed.classFull).not.toBe(context.classFull);
    expect(parsed.classFull.assignments).not.toBe(context.classFull.assignments);
    expect(parsed.assignmentDefinitionPartials).not.toBe(context.assignmentDefinitionPartials);
    expect(parsed.averagingResult.perClass).not.toBe(context.averagingResult.perClass);
  });

  it('allows selected display evidence alongside the unsliced source class', () => {
    const context = createMetadataRefreshFixture('small');
    context.averagingResult.perTask = [];
    const parsed = PostAnalysisContextSchema.parse(context);
    expect(parsed.classFull.assignments).toEqual(context.classFull.assignments);
    expect(parsed.classFull.assignments.length).toBeGreaterThan(1);
    expect(parsed.averagingResult.perTask).toEqual([]);
  });

  it.each(['averagingResult', 'classFull', 'assignmentDefinitionPartials'] as const)(
    'requires validated %s without filling a missing input',
    (field) => {
      const context = createMetadataRefreshFixture('small');
      expect(PostAnalysisContextSchema.safeParse({ ...context, [field]: undefined }).success).toBe(
        false
      );
      expect(PostAnalysisContextSchema.safeParse({ ...context, [field]: null }).success).toBe(
        false
      );
    }
  );

  it('rejects mismatched analysis/class identities and malformed nested analysis', () => {
    const context = createMetadataRefreshFixture('small');
    expect(
      PostAnalysisContextSchema.safeParse({
        ...context,
        averagingResult: { ...context.averagingResult, classId: 'different-class' },
      }).success
    ).toBe(false);
    expect(
      PostAnalysisContextSchema.safeParse({
        ...context,
        averagingResult: { ...context.averagingResult, perClass: {} },
      }).success
    ).toBe(false);
    expect(
      PostAnalysisContextSchema.safeParse({
        ...context,
        assignmentDefinitionPartials: [{}],
      }).success
    ).toBe(false);
  });
});

describe('PostAnalysisTaskOutcomeDataSchema serialisable state', () => {
  it.each([
    { taskId: 'probe', status: 'pending' },
    { taskId: 'probe', status: 'succeeded' },
    { taskId: 'probe', status: 'succeeded', confirmedPersistence: true },
    { taskId: 'refreshABClassMetadata', status: 'skipped', reason: 'noAssignments' },
    { taskId: 'refreshABClassMetadata', status: 'skipped', reason: 'unchanged' },
    { taskId: 'refreshABClassMetadata', status: 'skipped', reason: 'staleSource' },
    { taskId: 'probe', status: 'failed' },
  ])('retains $status data without local execution handles', (data) => {
    expect(PostAnalysisTaskOutcomeDataSchema.parse(data)).toEqual(data);
  });

  it.each([
    { taskId: '', status: 'pending' },
    { taskId: 'probe', status: 'saved' },
    { taskId: 'probe', status: 'skipped' },
    { taskId: 'probe', status: 'skipped', reason: 'invented' },
    { taskId: 'probe', status: 'pending', reason: 'unchanged' },
    { taskId: 'probe', status: 'failed', error: new Error('technical detail') },
    { taskId: 'probe', status: 'succeeded', run: () => 'local execution' },
  ])('rejects invalid state or execution-only fields: $status', (data) => {
    expect(PostAnalysisTaskOutcomeDataSchema.safeParse(data).success).toBe(false);
  });
});
