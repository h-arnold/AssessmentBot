import { createComputedMetricResult } from './fixtures';

/**
 * Build analyser output that fails `DataAnalysisResponseSchema` at the class metric boundary.
 *
 * @returns {unknown} A deliberately malformed data-analysis response.
 */
export function createMalformedAnalyserOutput(): unknown {
  return [
    {
      classId: 'class-abc-123',
      className: 'Test Class 7A',
      perStudent: [],
      perTask: [],
      perClass: {
        completeness: {
          state: 'computed',
          value: 'N',
          totalWeight: 1,
          applicableDataPoints: 1,
          totalDataPoints: 1,
        },
        accuracy: createComputedMetricResult(),
        spag: createComputedMetricResult(),
        overall: createComputedMetricResult(),
      },
      appliedCriterionWeightings: { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
    },
  ];
}
