import { describe, expect, it } from 'vitest';

/**
 * Helper type for schema modules that export a `parse` method.
 */
interface ParseOnly {
  parse: (input: unknown) => unknown;
}

/**
 * Helper type for the metric/contribution schema module shape.
 */
interface MetricSchemaModule {
  MetricResultSchema: ParseOnly;
  AverageContributionSchema: ParseOnly;
}

/**
 * Dynamically loads the dataAnalysis.zod module for metric/contribution suites.
 *
 * @returns {Promise<MetricSchemaModule>} The imported module.
 */
async function loadDataAnalysisZod(): Promise<MetricSchemaModule> {
  return import('./dataAnalysis.zod') as unknown as Promise<MetricSchemaModule>;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const computedMetricResult = {
  state: 'computed' as const,
  value: 0.75,
  totalWeight: 2,
  applicableDataPoints: 2,
  totalDataPoints: 2,
};

const notAttemptedMetricResult = {
  state: 'notAttempted' as const,
  value: 'N' as const,
  totalWeight: 0,
  applicableDataPoints: 0 as const,
  totalDataPoints: 3,
};

const errorMetricResult = {
  state: 'error' as const,
  value: 'E' as const,
  totalWeight: 0,
  applicableDataPoints: 0 as const,
  totalDataPoints: 3,
};

const excludedMetricResult = {
  state: 'excluded' as const,
  value: null,
  totalWeight: 0,
  applicableDataPoints: 0,
  totalDataPoints: 2,
};

/** Positive contribution weight used across AverageContribution truth-table cases. */
const positiveEffectiveWeight = 0.4;

// ---------------------------------------------------------------------------
// MetricResultSchema — discriminated union (computed / notAttempted / error / excluded)
// ---------------------------------------------------------------------------

describe('MetricResultSchema', () => {
  it('round-trips a computed shape', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    const result = MetricResultSchema.parse(computedMetricResult);

    expect(result).toMatchObject({
      state: 'computed',
      value: 0.75,
      totalWeight: 2,
      applicableDataPoints: 2,
      totalDataPoints: 2,
    });
  });

  it('round-trips a notAttempted shape with value: "N"', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    const result = MetricResultSchema.parse(notAttemptedMetricResult);

    expect(result).toMatchObject({
      state: 'notAttempted',
      value: 'N',
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: 3,
    });
  });

  it('round-trips an error shape with value: "E"', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    const result = MetricResultSchema.parse(errorMetricResult);

    expect(result).toMatchObject({
      state: 'error',
      value: 'E',
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: 3,
    });
  });

  it('rejects a mismatched shape (state: "computed" with value: "N")', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    expect(() =>
      MetricResultSchema.parse({
        state: 'computed',
        value: 'N',
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      })
    ).toThrow();
  });

  it('rejects computed state with applicableDataPoints = 0', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    expect(() =>
      MetricResultSchema.parse({
        state: 'computed',
        value: 5,
        totalWeight: 1,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      })
    ).toThrow();
  });

  it('rejects notAttempted state with applicableDataPoints > 0', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    expect(() =>
      MetricResultSchema.parse({
        state: 'notAttempted',
        value: 'N',
        totalWeight: 0,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      })
    ).toThrow();
  });

  it('rejects error state with applicableDataPoints > 0', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    expect(() =>
      MetricResultSchema.parse({
        state: 'error',
        value: 'E',
        totalWeight: 0,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      })
    ).toThrow();
  });

  it('accepts a valid excluded aggregate shape', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    const result = MetricResultSchema.parse(excludedMetricResult);

    expect(result).toMatchObject({
      state: 'excluded',
      value: null,
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: 2,
    });
  });

  it.each([{ value: 1 }, { totalWeight: 1 }, { applicableDataPoints: 1 }, { totalDataPoints: 0 }])(
    'rejects excluded with %j',
    async (patch) => {
      const { MetricResultSchema } = await loadDataAnalysisZod();

      expect(() => MetricResultSchema.parse({ ...excludedMetricResult, ...patch })).toThrow();
    }
  );
});

// ---------------------------------------------------------------------------
// AverageContributionSchema — effectiveWeight / includedInAverage invariant
// ---------------------------------------------------------------------------

describe('AverageContributionSchema', () => {
  it.each([
    [positiveEffectiveWeight, true],
    [0, false],
  ])(
    'accepts effectiveWeight=%s with includedInAverage=%s',
    async (effectiveWeight, includedInAverage) => {
      const { AverageContributionSchema } = await loadDataAnalysisZod();

      expect(AverageContributionSchema.parse({ effectiveWeight, includedInAverage })).toEqual({
        effectiveWeight,
        includedInAverage,
      });
    }
  );

  it.each([
    [0, true],
    [positiveEffectiveWeight, false],
  ])(
    'rejects contradictory pair effectiveWeight=%s with includedInAverage=%s',
    async (effectiveWeight, includedInAverage) => {
      const { AverageContributionSchema } = await loadDataAnalysisZod();

      expect(() =>
        AverageContributionSchema.parse({ effectiveWeight, includedInAverage })
      ).toThrow();
    }
  );

  it('rejects a negative effectiveWeight', async () => {
    const { AverageContributionSchema } = await loadDataAnalysisZod();

    expect(() =>
      AverageContributionSchema.parse({ effectiveWeight: -0.1, includedInAverage: false })
    ).toThrow();
  });
});
