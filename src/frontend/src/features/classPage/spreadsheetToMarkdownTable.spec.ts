/**
 * Red-phase tests for `spreadsheetToMarkdownTable` — a pure function that
 * converts a spreadsheet 2D array (`Array<Array<string | number | null>>`)
 * to a GitHub-flavoured markdown table string.
 *
 * These tests WILL fail at import time because the implementation module
 * does not yet exist (TDD red phase).
 *
 * ## Markdown format convention
 *
 * The implementation is expected to produce rows of the form:
 * ```
 * | cell1 | cell2 |
 * | --- | --- |
 * | val1 | val2 |
 * ```
 *
 * - Each row starts with `| ` and ends with ` |`.
 * - Cells within a row are joined with ` | `.
 * - The separator row uses one `---` per column, i.e. `| --- | --- |`.
 * - Rows are separated by `\n` (no trailing newline after the last row).
 * - An empty input array `[]` returns `''`.
 * - Null cells render as the empty string `''` (i.e. `|  |`).
 * - Numbers render as their string representation via `String(n)`.
 * - The pipe character `|` inside a cell value is escaped as `\|`.
 */

import { describe, it, expect } from 'vitest';
import { spreadsheetToMarkdownTable } from './spreadsheetToMarkdownTable';

// ===========================================================================
// Types
// ===========================================================================

/**
 * A 2D array representing spreadsheet rows where each cell can be a string,
 * a number, or null.
 */
type SpreadsheetRows = Array<Array<string | number | null>>;

// ===========================================================================
// Tests
// ===========================================================================

describe('spreadsheetToMarkdownTable', () => {
  // -----------------------------------------------------------------------
  // Empty array
  // -----------------------------------------------------------------------
  it('returns an empty string for an empty array', () => {
    expect(spreadsheetToMarkdownTable([])).toBe('');
  });

  // -----------------------------------------------------------------------
  // Header + one data row
  // -----------------------------------------------------------------------
  it('converts header row and one data row into a GFM table', () => {
    const scoreB = 2;
    const input: SpreadsheetRows = [
      ['A', 'B'],
      [1, scoreB],
    ];
    const result = spreadsheetToMarkdownTable(input);

    const expected = ['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n');

    expect(result).toBe(expected);
  });

  // -----------------------------------------------------------------------
  // Header-only (no data rows)
  // -----------------------------------------------------------------------
  it('produces header + separator even when there are no data rows', () => {
    const input: SpreadsheetRows = [['Name', 'Score']];
    const result = spreadsheetToMarkdownTable(input);

    const expected = ['| Name | Score |', '| --- | --- |'].join('\n');

    expect(result).toBe(expected);
  });

  // -----------------------------------------------------------------------
  // Mixed types with null
  // -----------------------------------------------------------------------
  it('renders null cells as empty and numbers as strings', () => {
    const aliceScore = 95;
    const input: SpreadsheetRows = [
      ['Name', 'Score'],
      ['Alice', aliceScore],
      ['Bob', null],
    ];
    const result = spreadsheetToMarkdownTable(input);

    const expected = ['| Name | Score |', '| --- | --- |', '| Alice | 95 |', '| Bob |  |'].join(
      '\n'
    );

    expect(result).toBe(expected);
  });

  // -----------------------------------------------------------------------
  // Pipe character escaping
  // -----------------------------------------------------------------------
  it(String.raw`escapes pipe characters inside cell values as \|`, () => {
    const input: SpreadsheetRows = [['A | B'], [1]];
    const result = spreadsheetToMarkdownTable(input);

    const expected = [String.raw`| A \| B |`, '| --- |', '| 1 |'].join('\n');

    expect(result).toBe(expected);
  });
});
