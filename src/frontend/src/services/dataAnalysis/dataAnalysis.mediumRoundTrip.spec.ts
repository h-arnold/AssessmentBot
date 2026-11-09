/**
 * Medium-corpus absolute-mode round trip through the data-analysis service.
 *
 * Pins that a real class from the committed `medium` profile analyses in
 * explicit `absolute` mode and echoes the applied mode without a baseline
 * block, while every per-task row is marked as included in the attempt
 * baseline.
 *
 * The committed views are imported at this call site with the `?raw` suffix,
 * following the established pattern in
 * `analysers/averagingAnalyser.metricResolution.spec.ts`: record loading stays
 * at the call site and no shared loader is created.
 *
 * @see docs/developer/testing/synthetic-test-data.md
 */

import { describe, expect, it } from 'vitest';
import mediumClassesByIdRaw from '@synthetic/medium/classesById.json?raw';
import mediumPartialsRaw from '@synthetic/medium/assignmentDefinitionPartials.json?raw';
import { DataAnalysisService } from './dataAnalysisService';
import { AveragingAnalyserInputSchema } from './dataAnalysis.zod';
import type { AveragingAnalyserInput } from './dataAnalysis.zod';

/** `medium` class analysed by this suite. */
const MEDIUM_CLASS_ID = 'class-0';

type CanonicalClassesById = Record<string, unknown>;

/**
 * Build the validated absolute-mode input for the committed `medium` class.
 *
 * @returns {AveragingAnalyserInput} The validated analysis input.
 */
function buildMediumInput(): AveragingAnalyserInput {
  const classesById = JSON.parse(mediumClassesByIdRaw) as CanonicalClassesById;
  const classRecord = classesById[MEDIUM_CLASS_ID];
  if (classRecord === undefined) {
    throw new Error(
      `medium round-trip spec: ${MEDIUM_CLASS_ID} is missing from the committed corpus.`
    );
  }

  // The committed corpus payload is validated by the schema below; `parse`
  // accepts `unknown`, so the JSON-parsed class needs no cast.
  return AveragingAnalyserInputSchema.parse({
    filter: { classIds: [MEDIUM_CLASS_ID], analysisMode: 'absolute' },
    classes: [classRecord],
    assignmentDefinitionPartials: JSON.parse(mediumPartialsRaw),
  });
}

describe('medium corpus absolute-mode round trip', () => {
  it('echoes appliedAnalysisMode absolute and omits the attempt baseline block', () => {
    const results = new DataAnalysisService().analyse(buildMediumInput());

    expect(results).toHaveLength(1);
    const [result] = results;
    expect(result.classId).toBe(MEDIUM_CLASS_ID);
    expect(result.appliedAnalysisMode).toBe('absolute');
    expect(result).not.toHaveProperty('attemptBaseline');
  });

  it('marks every per-task row as included in the attempt baseline', () => {
    const [result] = new DataAnalysisService().analyse(buildMediumInput());

    expect(result.perTask.length).toBeGreaterThan(0);
    for (const row of result.perTask) {
      expect(row.includedInAttemptBaseline).toBe(true);
    }
  });

  it('keeps the per-(student, task) evidence free of a baseline flag', () => {
    const [result] = new DataAnalysisService().analyse(buildMediumInput());

    expect(result.perStudentTaskMetrics?.length).toBeGreaterThan(0);
    if (result.perStudentTaskMetrics != null) {
      for (const metric of result.perStudentTaskMetrics) {
        expect(metric).not.toHaveProperty('includedInAttemptBaseline');
      }
    }
  });
});
