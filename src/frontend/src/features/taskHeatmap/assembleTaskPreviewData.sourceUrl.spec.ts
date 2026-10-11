/**
 * Tests for `assembleTaskPreviewData`'s derived `sourceUrl` carry-through —
 * the assembled `TaskPreviewData` must forward the cell's editor source link
 * unchanged for every artifact content shape and metric key, preserve an
 * explicit `null`, and report `null` when no cell data exists at all.
 *
 * Split from `assembleTaskPreviewData.spec.ts` so each file stays under the
 * `max-lines` budget, following the `buildCellPreviewLookup` spec family.
 */

import { describe, it, expect } from 'vitest';
import { assembleTaskPreviewData } from './assembleTaskPreviewData';
import type { CellPreviewData } from './buildCellPreviewLookup';
import { createComputedMetricResult } from '../../test/dataAnalysis/fixtures';

// ===========================================================================
// Fixture constants
// ===========================================================================

/** Editor source URL carried by the populated carry-through fixtures. */
const SOURCE_URL = 'https://docs.google.com/presentation/d/doc-preview/edit#slide=id.7';

/** Score value used by the carry-through fixture metrics. */
const CARRY_THROUGH_SCORE = 4;

/** Student score carried inside the SPREADSHEET cell fixture content. */
const SPREADSHEET_CELL_SCORE = 95;

/** Cell fixtures covering every artifact content shape assembly coerces. */
const CONTENT_SOURCE_URL_CELLS: ReadonlyArray<{ label: string; cell: CellPreviewData }> = [
  {
    label: 'TEXT',
    cell: {
      artifactType: 'TEXT',
      artifactContent: 'Essay body',
      reasoning: { completeness: 'Covered the brief', accuracy: null, spag: null },
      sourceUrl: SOURCE_URL,
    },
  },
  {
    label: 'TABLE',
    cell: {
      artifactType: 'TABLE',
      artifactContent: '| A | B |\n|---|---|\n| 1 | 2 |',
      reasoning: { completeness: null, accuracy: 'Accurate values', spag: null },
      sourceUrl: SOURCE_URL,
    },
  },
  {
    label: 'IMAGE',
    cell: {
      artifactType: 'IMAGE',
      artifactContent: 'data:image/png;base64,iVBORw0KGgo=',
      reasoning: { completeness: null, accuracy: null, spag: 'Clear labels' },
      sourceUrl: SOURCE_URL,
    },
  },
  {
    label: 'SPREADSHEET',
    cell: {
      artifactType: 'SPREADSHEET',
      artifactContent: [
        ['Name', 'Score'],
        ['Alice', SPREADSHEET_CELL_SCORE],
      ],
      reasoning: { completeness: 'Complete grid', accuracy: null, spag: null },
      sourceUrl: SOURCE_URL,
    },
  },
  {
    label: 'base',
    cell: {
      artifactType: 'base',
      artifactContent: null,
      reasoning: { completeness: null, accuracy: null, spag: null },
      sourceUrl: SOURCE_URL,
    },
  },
];

// ===========================================================================
// Carry-through matrix
// ===========================================================================

describe('assembleTaskPreviewData sourceUrl carry-through', () => {
  it.each(CONTENT_SOURCE_URL_CELLS)(
    'carries the sourceUrl unchanged for $label artifact content',
    ({ cell }) => {
      const result = assembleTaskPreviewData(
        cell,
        createComputedMetricResult({ value: CARRY_THROUGH_SCORE }),
        'completeness',
        'task-source-1'
      );

      expect(result.sourceUrl).toBe(SOURCE_URL);
    }
  );

  it('carries the sourceUrl unchanged for every metric key', () => {
    const cell = CONTENT_SOURCE_URL_CELLS[0].cell;

    for (const metricKey of ['completeness', 'accuracy', 'spag'] as const) {
      const result = assembleTaskPreviewData(
        cell,
        createComputedMetricResult({ value: CARRY_THROUGH_SCORE }),
        metricKey,
        'task-source-2'
      );

      expect(result.sourceUrl).toBe(SOURCE_URL);
    }
  });

  it('carries a null sourceUrl unchanged', () => {
    const cell: CellPreviewData = {
      artifactType: 'TEXT',
      artifactContent: 'No stored link',
      reasoning: { completeness: null, accuracy: null, spag: null },
      sourceUrl: null,
    };

    const result = assembleTaskPreviewData(
      cell,
      createComputedMetricResult({ value: CARRY_THROUGH_SCORE }),
      'completeness',
      'task-source-3'
    );

    expect(result.sourceUrl).toBeNull();
  });

  it('returns sourceUrl null when cellData is missing', () => {
    const result = assembleTaskPreviewData(
      null,
      createComputedMetricResult({ value: CARRY_THROUGH_SCORE }),
      'completeness',
      'task-source-4'
    );

    expect(result.sourceUrl).toBeNull();
  });
});
