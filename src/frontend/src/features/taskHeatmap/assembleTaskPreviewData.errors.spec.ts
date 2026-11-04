/**
 * Error-precedence tests for `assembleTaskPreviewData`.
 *
 * Pins the precedence an opened preview applies to the selected criterion: an
 * explicit full-record validation error first, then the class-partial `E`, then
 * the selected full item's `E`, then the existing analyser metric. Each
 * assembled preview also carries the resolved `sourceState` and the recorded
 * reasoning for the criterion it was assembled for.
 *
 * The full-record and class-partial layers arrive as explicit
 * `CellPreviewData` fixtures, because assembly receives the already-resolved
 * cell; the lookup and query layers that derive those cells are pinned by their
 * own companions. Healthy and error fixtures are local probes.
 */

import { describe, it, expect } from 'vitest';
import { assembleTaskPreviewData } from './assembleTaskPreviewData';
import type { CellPreviewData, AssessmentError } from './buildCellPreviewLookup';
import { NOT_ATTEMPTED_METRIC } from '@/services/dataAnalysis/heatmapAdapter';
import type { TaskDisplayMetric } from '@/services/dataAnalysis/dataAnalysis.zod';
import { createComputedMetricResult, createErrorMetricResult } from '@/test/dataAnalysis/fixtures';

/** Cause recorded for a full-record validation failure. */
const VALIDATION_CAUSE: AssessmentError = { stage: 'validation', code: 'CORRUPT_RECORD' };
/** Cause recorded for an extraction failure. */
const EXTRACTION_CAUSE: AssessmentError = {
  stage: 'extraction',
  code: 'SOURCE_CONTENT_UNAVAILABLE',
};
/** Cause recorded for an assessment failure. */
const ASSESSMENT_CAUSE: AssessmentError = { stage: 'assessment', code: 'ASSESSMENT_FAILED' };

/** Reasoning recorded alongside the full-record validation failure. */
const VALIDATION_REASONING = 'The stored assessment data for this task is invalid.';
/** Reasoning recorded alongside the class-partial extraction failure. */
const PARTIAL_REASONING = 'No source content could be extracted for this task.';
/** Reasoning recorded alongside the selected full item's assessment failure. */
const ITEM_REASONING = 'The assessment service rejected the request.';

/** Analyser metric used where the analyser layer must win. */
const ANALYSER_METRIC: TaskDisplayMetric = createComputedMetricResult({ value: 4 });
/** Error metric used where the analyser layer reports an error. */
const ERROR_METRIC: TaskDisplayMetric = createErrorMetricResult();

/**
 * Build a TEXT cell preview fixture carrying explicit per-criterion outcomes.
 *
 * @param {Object} outcomes - Per-criterion reasoning and cause.
 * @param {string|null} [outcomes.completenessReasoning] - Completeness reasoning.
 * @param {AssessmentError|null} [outcomes.completenessError] - Completeness cause.
 * @param {string|null} [outcomes.sourceUrl] - Derived source link.
 * @returns {CellPreviewData} The cell fixture.
 */
function textCell(outcomes: {
  completenessReasoning?: string | null;
  completenessError?: AssessmentError | null;
  sourceUrl?: string | null;
}): CellPreviewData {
  return {
    artifactType: 'TEXT',
    artifactContent: 'Student response body',
    reasoning: {
      completeness: outcomes.completenessReasoning ?? null,
      accuracy: null,
      spag: null,
    },
    errors: {
      completeness: outcomes.completenessError ?? null,
      accuracy: null,
      spag: null,
    },
    sourceUrl: outcomes.sourceUrl ?? null,
  };
}

describe('assembleTaskPreviewData error precedence', () => {
  it('carries the selected criterion cause and reasoning from the resolved cell', () => {
    const cell = textCell({
      completenessReasoning: ITEM_REASONING,
      completenessError: ASSESSMENT_CAUSE,
    });

    const result = assembleTaskPreviewData(cell, ERROR_METRIC, 'completeness', 'task-error-1');

    expect(result.error).toEqual(ASSESSMENT_CAUSE);
    expect(result.reasoning).toBe(ITEM_REASONING);
  });

  it('selects the cause for the requested criterion only', () => {
    const cell = textCell({
      completenessReasoning: ITEM_REASONING,
      completenessError: ASSESSMENT_CAUSE,
    });

    const result = assembleTaskPreviewData(cell, ANALYSER_METRIC, 'accuracy', 'task-error-2');

    // Accuracy has no recorded cause, so a completeness error must not leak in.
    expect(result.error).toBeNull();
    expect(result.reasoning).toBe('');
  });

  it('reports an explicit full-record validation error over a known class-partial error', () => {
    // Precedence 1: the full-record validation error wins over the class-partial
    // extraction error even though both describe the same criterion.
    const cell = textCell({
      completenessReasoning: VALIDATION_REASONING,
      completenessError: VALIDATION_CAUSE,
    });

    const result = assembleTaskPreviewData(cell, ERROR_METRIC, 'completeness', 'task-error-3');

    expect(result.error).toEqual(VALIDATION_CAUSE);
    expect(result.error).not.toEqual(EXTRACTION_CAUSE);
    expect(result.reasoning).toBe(VALIDATION_REASONING);
  });

  it('reports the class-partial error over the selected full item error', () => {
    // Precedence 2: with no full-record validation error, the class-partial E
    // for the criterion is the winning cause and explanation.
    const cell = textCell({
      completenessReasoning: PARTIAL_REASONING,
      completenessError: EXTRACTION_CAUSE,
    });

    const result = assembleTaskPreviewData(cell, ERROR_METRIC, 'completeness', 'task-error-3b');

    expect(result.error).toEqual(EXTRACTION_CAUSE);
    expect(result.error).not.toEqual(ASSESSMENT_CAUSE);
    expect(result.reasoning).toBe(PARTIAL_REASONING);
  });

  it('overrides a class-derived numeric score with the error state when a full-record E wins', () => {
    // Precedence 1 over a class-derived numeric: the class partial (and so the
    // analyser metric) still carries the historic numeric value, but the
    // full-record validation error overrides the preview's score with E. The
    // table keeps its class-derived value; only the preview is overridden.
    const cell = textCell({
      completenessReasoning: VALIDATION_REASONING,
      completenessError: VALIDATION_CAUSE,
    });

    const result = assembleTaskPreviewData(cell, ANALYSER_METRIC, 'completeness', 'task-error-4a');

    expect(result.metric).toMatchObject({ state: 'error', value: 'E' });
    expect(result.error).toEqual(VALIDATION_CAUSE);
    expect(result.reasoning).toBe(VALIDATION_REASONING);
  });

  it('keeps a known error over the analyser metric', () => {
    const cell = textCell({
      completenessReasoning: ITEM_REASONING,
      completenessError: ASSESSMENT_CAUSE,
    });

    const result = assembleTaskPreviewData(cell, ANALYSER_METRIC, 'completeness', 'task-error-4');

    // The known cause wins over the analyser metric: the preview shows the
    // error state for the affected criterion instead of the class-derived
    // numeric score, and the cause is never replaced by the metric state.
    expect(result.metric).toMatchObject({ state: 'error', value: 'E' });
    expect(result.error).toEqual(ASSESSMENT_CAUSE);
  });

  it('falls back to the analyser metric when the cell records no cause', () => {
    const cell = textCell({ completenessReasoning: 'Healthy reasoning' });

    const result = assembleTaskPreviewData(cell, ANALYSER_METRIC, 'completeness', 'task-error-5');

    expect(result.error).toBeNull();
    expect(result.metric).toBe(ANALYSER_METRIC);
    expect(result.reasoning).toBe('Healthy reasoning');
  });

  it('reports a known error with a null source link as an unavailable source', () => {
    const cell = textCell({
      completenessReasoning: PARTIAL_REASONING,
      completenessError: EXTRACTION_CAUSE,
      sourceUrl: null,
    });

    const result = assembleTaskPreviewData(cell, ERROR_METRIC, 'completeness', 'task-error-6');

    expect(result.error).toEqual(EXTRACTION_CAUSE);
    expect(result.sourceUrl).toBeNull();
    expect(result.sourceState).toBe('unavailable');
  });

  it('reports an assessment-only error with a usable source as available', () => {
    const sourceUrl = 'https://docs.google.com/presentation/d/doc-error/edit#slide=id.4';
    const cell = textCell({
      completenessReasoning: ITEM_REASONING,
      completenessError: ASSESSMENT_CAUSE,
      sourceUrl,
    });

    const result = assembleTaskPreviewData(cell, ERROR_METRIC, 'completeness', 'task-error-7');

    expect(result.error).toEqual(ASSESSMENT_CAUSE);
    expect(result.sourceState).toBe('available');
    expect(result.sourceUrl).toBe(sourceUrl);
  });

  it('reports a confirmed no-submission as a ready N placeholder with no error', () => {
    const result = assembleTaskPreviewData(null, ANALYSER_METRIC, 'completeness', 'task-error-8');

    expect(result.metric).toBe(NOT_ATTEMPTED_METRIC);
    expect(result.error).toBeNull();
    expect(result.reasoning).toBe('');
    expect(result.sourceUrl).toBeNull();
    expect(result.sourceState).toBe('available');
  });
});
