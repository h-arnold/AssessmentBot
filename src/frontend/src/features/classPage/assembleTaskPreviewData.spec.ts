/**
 * Red-phase tests for `assembleTaskPreviewData` — a pure function that
 * assembles a `TaskPreviewData` from a `CellPreviewData` (or `null`), the
 * analyser's `MetricResult`, the metric key, and the task ID.
 *
 * These tests WILL fail at import time because the implementation module
 * does not yet exist (TDD red phase).
 */

import { describe, it, expect } from 'vitest';
import { assembleTaskPreviewData } from './assembleTaskPreviewData';
import type { CellPreviewData } from './buildCellPreviewLookup';
import { spreadsheetToMarkdownTable } from './spreadsheetToMarkdownTable';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';

// ===========================================================================
// Fixture constants
// ===========================================================================

/** Default total weight for a computed metric in test fixtures. */
const DEFAULT_WEIGHT = 1;
/** Minimum applicable data points for a computed metric. */
const MIN_DATA_POINTS = 1;

/** Score value used for TEXT artifact test assertion. */
const TEXT_SCORE = 4;
/** Score value used for TABLE artifact test assertion. */
const TABLE_SCORE = 5;
/** Score value used for IMAGE artifact test assertion. */
const IMAGE_SCORE = 3;
/** Score value used for base artifact test assertion. */
const BASE_SCORE = 2;
/** Score value used for null cellData test assertion. */
const NULL_CELL_SCORE = 4;
/** Score value used for reasoning-present test assertion. */
const REASONING_PRESENT_SCORE = 5;
/** Score value used for reasoning-absent test assertion. */
const REASONING_ABSENT_SCORE = 4;
/** Score value used for metricKey pass-through tests. */
const METRIC_KEY_SCORE = 3;
/** Score value used for populated taskId pass-through test. */
const TASK_ID_POPULATED_SCORE = 5;
/** Score value used for null taskId pass-through test. */
const TASK_ID_NULL_SCORE = 3;

/** Alice spreadsheet score for the SPREADSHEET test fixture. */
const ALICE_SCORE = 95;
/** Bob spreadsheet score for the SPREADSHEET test fixture. */
const BOB_SCORE = 78;
/** Score value used for SPREADSHEET artifact test assertion. */
const SPREADSHEET_SCORE = 5;

// ===========================================================================
// Fixture factories
// ===========================================================================

/**
 * Create a computed MetricResult with the given value and defaults.
 *
 * @param {number} value - The numeric metric score.
 * @returns {MetricResult} A computed MetricResult fixture.
 */
function computedMetric(value: number): MetricResult {
  return {
    state: 'computed' as const,
    value,
    totalWeight: DEFAULT_WEIGHT,
    applicableDataPoints: MIN_DATA_POINTS,
    totalDataPoints: MIN_DATA_POINTS,
  };
}

/** A ready-made notAttempted MetricResult. */
const NOT_ATTEMPTED_METRIC: MetricResult = {
  state: 'notAttempted' as const,
  value: 'N' as const,
  totalWeight: 0,
  applicableDataPoints: 0,
  totalDataPoints: MIN_DATA_POINTS,
};

/** A ready-made error MetricResult. */
const ERROR_METRIC: MetricResult = {
  state: 'error' as const,
  value: 'E' as const,
  totalWeight: 0,
  applicableDataPoints: 0,
  totalDataPoints: 0,
};

/**
 * Create a CellPreviewData for the given artifact type, content and reasoning.
 *
 * @param {CellPreviewData['artifactType']} artifactType - The artifact type discriminator.
 * @param {unknown} artifactContent - The raw artifact content.
 * @param {Partial<CellPreviewData['reasoning']>} [overrides] - Optional per-metric reasoning overrides.
 * @returns {CellPreviewData} A CellPreviewData fixture.
 */
function cellData(
  artifactType: CellPreviewData['artifactType'],
  artifactContent: unknown,
  overrides?: Partial<CellPreviewData['reasoning']>
): CellPreviewData {
  return {
    artifactType,
    artifactContent,
    reasoning: {
      completeness: overrides?.completeness ?? null,
      accuracy: overrides?.accuracy ?? null,
      spag: overrides?.spag ?? null,
    },
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('assembleTaskPreviewData', () => {
  // -------------------------------------------------------------------------
  // Artifact type coercions
  // -------------------------------------------------------------------------

  it('maps a TEXT artifact to artifactType TEXT with string content', () => {
    const data = cellData('TEXT', 'Student wrote an essay.');

    const result = assembleTaskPreviewData(
      data,
      computedMetric(TEXT_SCORE),
      'completeness',
      'task-1'
    );

    expect(result.artifactType).toBe('TEXT');
    expect(result.artifactContent).toBe('Student wrote an essay.');
  });

  it('maps a TABLE artifact to artifactType TABLE with string content', () => {
    const tableContent = '| H1 | H2 |\n| --- | --- |\n| V1 | V2 |';
    const data = cellData('TABLE', tableContent);

    const result = assembleTaskPreviewData(data, computedMetric(TABLE_SCORE), 'accuracy', 'task-2');

    expect(result.artifactType).toBe('TABLE');
    expect(result.artifactContent).toBe(tableContent);
  });

  it('maps an IMAGE artifact to artifactType IMAGE with string content', () => {
    const imageUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const data = cellData('IMAGE', imageUrl);

    const result = assembleTaskPreviewData(data, computedMetric(IMAGE_SCORE), 'spag', 'task-3');

    expect(result.artifactType).toBe('IMAGE');
    expect(result.artifactContent).toBe(imageUrl);
  });

  it('maps a SPREADSHEET artifact to artifactType TABLE with markdown content', () => {
    const spreadsheetContent: Array<Array<string | number | null>> = [
      ['Name', 'Score'],
      ['Alice', ALICE_SCORE],
      ['Bob', BOB_SCORE],
    ];
    const data = cellData('SPREADSHEET', spreadsheetContent);
    const expectedMarkdown = spreadsheetToMarkdownTable(spreadsheetContent);

    const result = assembleTaskPreviewData(
      data,
      computedMetric(SPREADSHEET_SCORE),
      'completeness',
      'task-4'
    );

    expect(result.artifactType).toBe('TABLE');
    expect(result.artifactContent).toBe(expectedMarkdown);
  });

  it('maps a base artifact to artifactType TEXT with empty content', () => {
    const data = cellData('base', null);

    const result = assembleTaskPreviewData(data, computedMetric(BASE_SCORE), 'accuracy', 'task-5');

    expect(result.artifactType).toBe('TEXT');
    expect(result.artifactContent).toBe('');
  });

  it('handles null cellData with TEXT type and empty content and reasoning', () => {
    const result = assembleTaskPreviewData(
      null,
      computedMetric(NULL_CELL_SCORE),
      'completeness',
      'task-6'
    );

    expect(result.artifactType).toBe('TEXT');
    expect(result.artifactContent).toBe('');
    expect(result.reasoning).toBe('');
  });

  // -------------------------------------------------------------------------
  // Metric score and state pass-through
  // -------------------------------------------------------------------------

  it('passes through notAttempted metric state and score N', () => {
    const data = cellData('TEXT', 'Some content');

    const result = assembleTaskPreviewData(data, NOT_ATTEMPTED_METRIC, 'accuracy', 'task-7');

    expect(result.metricState).toBe('notAttempted');
    expect(result.metricScore).toBe('N');
  });

  it('passes through error metric state and score E', () => {
    const data = cellData('TABLE', 'Some table');

    const result = assembleTaskPreviewData(data, ERROR_METRIC, 'spag', 'task-8');

    expect(result.metricState).toBe('error');
    expect(result.metricScore).toBe('E');
  });

  it('passes through computed metric state and numeric score', () => {
    const data = cellData('TEXT', 'Some content');

    const result = assembleTaskPreviewData(data, computedMetric(TEXT_SCORE), 'accuracy', 'task-14');

    expect(result.metricState).toBe('computed');
    expect(result.metricScore).toBe(TEXT_SCORE);
  });

  // -------------------------------------------------------------------------
  // Reasoning extraction
  // -------------------------------------------------------------------------

  it('returns reasoning from cellData.reasoning[metricKey] when assessment is present', () => {
    const data = cellData('TEXT', 'Essay content', {
      completeness: 'Full coverage of all topics',
      accuracy: null,
      spag: null,
    });

    const result = assembleTaskPreviewData(
      data,
      computedMetric(REASONING_PRESENT_SCORE),
      'completeness',
      'task-9'
    );

    expect(result.reasoning).toBe('Full coverage of all topics');
  });

  it('returns empty reasoning when assessment is absent for the metric key', () => {
    const data = cellData('TEXT', 'Essay content', {
      completeness: 'Covered everything',
      accuracy: null,
      spag: null,
    });

    const result = assembleTaskPreviewData(
      data,
      computedMetric(REASONING_ABSENT_SCORE),
      'accuracy',
      'task-10'
    );

    expect(result.reasoning).toBe('');
  });

  // -------------------------------------------------------------------------
  // metricKey pass-through
  // -------------------------------------------------------------------------

  it('passes metricKey completeness through unchanged', () => {
    const data = cellData('TEXT', 'X');

    const result = assembleTaskPreviewData(
      data,
      computedMetric(METRIC_KEY_SCORE),
      'completeness',
      'task-11'
    );

    expect(result.metricKey).toBe('completeness');
  });

  it('passes metricKey accuracy through unchanged', () => {
    const data = cellData('TEXT', 'X');

    const result = assembleTaskPreviewData(
      data,
      computedMetric(METRIC_KEY_SCORE),
      'accuracy',
      'task-12'
    );

    expect(result.metricKey).toBe('accuracy');
  });

  it('passes metricKey spag through unchanged', () => {
    const data = cellData('TEXT', 'X');

    const result = assembleTaskPreviewData(
      data,
      computedMetric(METRIC_KEY_SCORE),
      'spag',
      'task-13'
    );

    expect(result.metricKey).toBe('spag');
  });

  // -------------------------------------------------------------------------
  // taskId pass-through
  // -------------------------------------------------------------------------

  it('forwards taskId unchanged when cellData is populated', () => {
    const data = cellData('TEXT', 'Populated response');

    const result = assembleTaskPreviewData(
      data,
      computedMetric(TASK_ID_POPULATED_SCORE),
      'completeness',
      'task-7'
    );

    expect(result.taskId).toBe('task-7');
  });

  it('forwards taskId unchanged when cellData is null', () => {
    const result = assembleTaskPreviewData(
      null,
      computedMetric(TASK_ID_NULL_SCORE),
      'spag',
      'task-9'
    );

    expect(result.taskId).toBe('task-9');
  });
});
