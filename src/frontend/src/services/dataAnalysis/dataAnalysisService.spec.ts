import { describe, it, expect } from 'vitest';
import { DataAnalysisService } from './dataAnalysisService';
import {
  DataAnalysisResponseSchema,
  type AveragingAnalyserInput,
  type DataAnalysisResponse,
} from './dataAnalysis.zod';
import {
  buildInput,
  createAssignmentPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from './test/fixtures';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DataAnalysisService', () => {
  describe('analyse', () => {
    // -----------------------------------------------------------------------
    // 1) Valid input returns a non-null array of AveragingResult
    // -----------------------------------------------------------------------
    it('returns a non-null array of AveragingResult for valid input', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          className: 'Test Class',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001')],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                }),
              ],
            }),
          ],
        },
      ]);

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      expect(results).not.toBeNull();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].classId).toBe('c_001');
    });

    // -----------------------------------------------------------------------
    // 2) Result passes DataAnalysisResponseSchema.parse() round-trip
    // -----------------------------------------------------------------------
    it('result passes DataAnalysisResponseSchema.parse() round-trip', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          className: 'Test Class',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001')],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', {
                    completeness: { score: 3 },
                    accuracy: { score: 4 },
                    spag: { score: 5 },
                  }),
                }),
              ],
            }),
          ],
        },
      ]);

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      // Should not throw
      const parsed = DataAnalysisResponseSchema.parse(results) as DataAnalysisResponse;
      expect(parsed).toEqual(results);
    });

    // -----------------------------------------------------------------------
    // 3) Invalid input (missing filter) throws ZodError
    // -----------------------------------------------------------------------
    it('throws a ZodError when input is missing the filter field', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          assignments: [],
        },
      ]);
      const invalidInput = {
        ...input,
        filter: undefined as unknown as AveragingAnalyserInput['filter'],
      };

      const service = new DataAnalysisService();

      expect(() => service.analyse(invalidInput)).toThrow();
    });

    // -----------------------------------------------------------------------
    // 4) appliedCriterionWeightings echoes constructor defaults
    // -----------------------------------------------------------------------
    it('appliedCriterionWeightings echoes defaults (0.4, 0.4, 0.2) when no custom filtering', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          className: 'Test Class',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001')],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                }),
              ],
            }),
          ],
        },
      ]);

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      expect(results[0].appliedCriterionWeightings).toEqual({
        completeness: 0.4,
        accuracy: 0.4,
        spag: 0.2,
      });
    });

    // -----------------------------------------------------------------------
    // 5) Invalid filter (empty classIds) throws ZodError
    // -----------------------------------------------------------------------
    it('throws a ZodError when filter.classIds is an empty array', () => {
      const input = buildInput([{ classId: 'c_001', assignments: [] }]);
      const invalidInput = { ...input, filter: { classIds: [] } };

      const service = new DataAnalysisService();

      expect(() => service.analyse(invalidInput)).toThrow();
    });

    // -----------------------------------------------------------------------
    // 6) Invalid filter (dateRange.from > to) throws ZodError
    // -----------------------------------------------------------------------
    it('throws a ZodError when filter.dateRange.from is after to', () => {
      const input = buildInput([{ classId: 'c_001', assignments: [] }]);
      const invalidInput = {
        ...input,
        filter: {
          classIds: ['c_001'],
          dateRange: { from: '2026-06-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' },
        },
      };

      const service = new DataAnalysisService();

      expect(() => service.analyse(invalidInput)).toThrow();
    });

    // -----------------------------------------------------------------------
    // 7) Invalid filter (criterionWeightings not summing to 1.0) throws ZodError
    // -----------------------------------------------------------------------
    it('throws a ZodError when filter.criterionWeightings do not sum to 1.0', () => {
      const input = buildInput([{ classId: 'c_001', assignments: [] }]);
      const invalidInput = {
        ...input,
        filter: {
          classIds: ['c_001'],
          criterionWeightings: { completeness: 1, accuracy: 1, spag: 1 },
        },
      };

      const service = new DataAnalysisService();

      expect(() => service.analyse(invalidInput)).toThrow();
    });

    // -----------------------------------------------------------------------
    // 8) Unregistered analyser key throws typed Error
    // -----------------------------------------------------------------------
    it('throws a typed Error when an unregistered analyser key is requested', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          assignments: [],
        },
      ]);

      const service = new DataAnalysisService();

      expect(() => service.analyse(input, 'bogusAnalyser')).toThrow(
        'Unknown analyser key: bogusAnalyser'
      );
    });

    // -----------------------------------------------------------------------
    // 9) Result array is sorted by classId
    // -----------------------------------------------------------------------
    it('returns results sorted by classId ascending', () => {
      const CLASS_COUNT = 2;

      const input = buildInput([
        {
          classId: 'c_002',
          className: 'Second Class',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001')],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                }),
              ],
            }),
          ],
        },
        {
          classId: 'c_001',
          className: 'First Class',
          studentIds: ['s_002'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_002',
              definitionKey: 'dk_geometry',
              tasks: [createTaskPartial('t_001')],
              submissions: [
                createSubmission('s_002', 'Bob', 'a_002', {
                  t_001: createSubmissionItem('t_001', { accuracy: { score: 3 } }),
                }),
              ],
            }),
          ],
        },
      ]);

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      expect(results).toHaveLength(CLASS_COUNT);
      expect(results[0].classId).toBe('c_001');
      expect(results[1].classId).toBe('c_002');
    });
  });
});
