import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AveragingAnalyser } from './analysers/averagingAnalyser';
import { DataAnalysisService } from './dataAnalysisService';
import { DataAnalysisResponseSchema, type DataAnalysisResponse } from './dataAnalysis.zod';
import { buildInput } from '../../test/dataAnalysis/fixtures';
import { createMalformedAnalyserOutput } from '../../test/dataAnalysis/diagnosticsFixtures';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DataAnalysisService output validation diagnostics', () => {
  it('rethrows the output ZodError without logging at the service boundary', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const malformedOutput = createMalformedAnalyserOutput();
    const expectedParse = DataAnalysisResponseSchema.safeParse(malformedOutput);
    expect(expectedParse.success).toBe(false);
    if (expectedParse.success) {
      throw new Error('Expected malformed analyser output to fail validation');
    }
    vi.spyOn(AveragingAnalyser.prototype, 'analyse').mockReturnValue(
      malformedOutput as DataAnalysisResponse
    );

    let thrownError: unknown;
    try {
      new DataAnalysisService().analyse(
        buildInput([{ classId: 'c-001', className: 'Test Class', assignments: [] }])
      );
    } catch (error: unknown) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(z.ZodError);
    expect((thrownError as z.ZodError).issues).toEqual(expectedParse.error.issues);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
