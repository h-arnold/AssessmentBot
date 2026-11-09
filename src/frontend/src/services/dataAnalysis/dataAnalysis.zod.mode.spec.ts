import { describe, expect, it } from 'vitest';

/**
 * Helper type for schema modules that export a `parse` method.
 */
interface ParseOnly {
  parse: (input: unknown) => unknown;
}

/**
 * Helper type for the analysis-mode schema module shape.
 */
interface AnalysisModeSchemaModule {
  AnalysisFilterSchema: ParseOnly;
  AveragingResultSchema: ParseOnly;
  AnalysisModeSchema: { options: readonly string[] };
}

/**
 * Dynamically loads the dataAnalysis.zod module for mode-contract suites.
 *
 * @returns {Promise<AnalysisModeSchemaModule>} The imported module.
 */
async function loadDataAnalysisZod(): Promise<AnalysisModeSchemaModule> {
  return import('./dataAnalysis.zod');
}

// ---------------------------------------------------------------------------
// AnalysisModeSchema / AnalysisFilterSchema.analysisMode
// ---------------------------------------------------------------------------

describe('AnalysisModeSchema', () => {
  it('exposes exactly the absolute and topDecileBaseline modes', async () => {
    const { AnalysisModeSchema } = await loadDataAnalysisZod();

    expect(AnalysisModeSchema.options).toEqual(['absolute', 'topDecileBaseline']);
  });
});

describe('AnalysisFilterSchema.analysisMode', () => {
  it('rejects a filter that omits analysisMode', async () => {
    const { AnalysisFilterSchema } = await loadDataAnalysisZod();

    expect(() => AnalysisFilterSchema.parse({ classIds: ['c1'] })).toThrow();
  });

  it('accepts the absolute mode', async () => {
    const { AnalysisFilterSchema } = await loadDataAnalysisZod();

    const result = AnalysisFilterSchema.parse({ classIds: ['c1'], analysisMode: 'absolute' });

    expect(result).toEqual({ classIds: ['c1'], analysisMode: 'absolute' });
  });

  it('accepts the topDecileBaseline mode', async () => {
    const { AnalysisFilterSchema } = await loadDataAnalysisZod();

    const result = AnalysisFilterSchema.parse({
      classIds: ['c1'],
      analysisMode: 'topDecileBaseline',
    });

    expect(result).toEqual({ classIds: ['c1'], analysisMode: 'topDecileBaseline' });
  });

  it('rejects an unknown mode value', async () => {
    const { AnalysisFilterSchema } = await loadDataAnalysisZod();

    expect(() =>
      AnalysisFilterSchema.parse({ classIds: ['c1'], analysisMode: 'percentileBaseline' })
    ).toThrow();
  });

  it('rejects unknown keys alongside a valid analysisMode (strict object)', async () => {
    const { AnalysisFilterSchema } = await loadDataAnalysisZod();

    expect(() => {
      return AnalysisFilterSchema.parse({
        classIds: ['c1'],
        analysisMode: 'absolute',
        unknownFilterKey: 'not permitted',
      });
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// AveragingResultSchema echo block — appliedAnalysisMode / attemptBaseline
// ---------------------------------------------------------------------------

/**
 * Build the smallest result shape that exercises the mode echo block.
 *
 * @param {Object} overrides - Fields layered over the minimal absolute-mode result.
 * @returns {Object} A schema-shaped averaging result candidate.
 */
function buildEchoResultCandidate(overrides: Record<string, unknown>) {
  const computedMetric = {
    state: 'computed',
    value: 4,
    totalWeight: 1,
    applicableDataPoints: 1,
    totalDataPoints: 1,
  };

  return {
    classId: 'c-1',
    className: 'Test Class',
    perStudent: [],
    perTask: [],
    perClass: {
      completeness: computedMetric,
      accuracy: computedMetric,
      spag: computedMetric,
      overall: computedMetric,
    },
    appliedCriterionWeightings: { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
    ...overrides,
  };
}

describe('AveragingResultSchema mode echo', () => {
  it('rejects a result that omits appliedAnalysisMode', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    expect(() => AveragingResultSchema.parse(buildEchoResultCandidate({}))).toThrow();
  });

  it('accepts an absolute-mode result without attemptBaseline', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    const result = AveragingResultSchema.parse(
      buildEchoResultCandidate({ appliedAnalysisMode: 'absolute' })
    ) as Record<string, unknown>;

    expect(result.appliedAnalysisMode).toBe('absolute');
    expect(result).not.toHaveProperty('attemptBaseline');
  });

  it('accepts a baseline-mode result carrying a valid attemptBaseline block', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    const result = AveragingResultSchema.parse(
      buildEchoResultCandidate({
        appliedAnalysisMode: 'topDecileBaseline',
        attemptBaseline: {
          poolStudentIds: ['s-1', 's-2'],
          baselineTaskKeys: ['def-1::t-1'],
        },
      })
    ) as { attemptBaseline: unknown };

    expect(result.attemptBaseline).toEqual({
      poolStudentIds: ['s-1', 's-2'],
      baselineTaskKeys: ['def-1::t-1'],
    });
  });

  it('rejects an attemptBaseline pool with fewer than 2 students', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    expect(() => {
      return AveragingResultSchema.parse(
        buildEchoResultCandidate({
          appliedAnalysisMode: 'topDecileBaseline',
          attemptBaseline: {
            poolStudentIds: ['s-1'],
            baselineTaskKeys: ['def-1::t-1'],
          },
        })
      );
    }).toThrow();
  });

  it('rejects an attemptBaseline block with an empty baselineTaskKeys array', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    expect(() => {
      return AveragingResultSchema.parse(
        buildEchoResultCandidate({
          appliedAnalysisMode: 'topDecileBaseline',
          attemptBaseline: {
            poolStudentIds: ['s-1', 's-2'],
            baselineTaskKeys: [],
          },
        })
      );
    }).toThrow();
  });

  it('rejects an attemptBaseline block with an empty baseline task key', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    expect(() => {
      return AveragingResultSchema.parse(
        buildEchoResultCandidate({
          appliedAnalysisMode: 'topDecileBaseline',
          attemptBaseline: {
            poolStudentIds: ['s-1', 's-2'],
            baselineTaskKeys: [''],
          },
        })
      );
    }).toThrow();
  });

  it('rejects unknown keys inside the attemptBaseline block (strict object)', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    expect(() => {
      return AveragingResultSchema.parse(
        buildEchoResultCandidate({
          appliedAnalysisMode: 'topDecileBaseline',
          attemptBaseline: {
            poolStudentIds: ['s-1', 's-2'],
            baselineTaskKeys: ['def-1::t-1'],
            extraBaselineField: true,
          },
        })
      );
    }).toThrow();
  });
});
