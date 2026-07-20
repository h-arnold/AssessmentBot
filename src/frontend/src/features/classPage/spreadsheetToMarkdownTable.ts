/**
 * A 2D array representing spreadsheet rows where each cell can be a string,
 * a number, or null.
 */
type SpreadsheetRows = Array<Array<string | number | null>>;

/**
 * Formats a single cell value for GFM markdown table output.
 *
 * - Null cells render as an empty string.
 * - Numbers are converted via `String(n)`.
 * - Pipe characters (`|`) inside cell text are escaped as `\|`.
 *
 * @param {string | number | null} cell - The cell value to format.
 * @returns {string} The formatted string representation of the cell.
 */
function formatCell(cell: string | number | null): string {
  if (cell === null) {
    return '';
  }
  return String(cell).replaceAll(String.raw`|`, String.raw`\|`);
}

/**
 * Builds a single GFM markdown table row from an array of cell values.
 *
 * @param {Array<string | number | null>} row - The array of cell values for the row.
 * @returns {string} The formatted pipe-delimited row string.
 */
function buildRow(row: SpreadsheetRows[number]): string {
  const formatted = row.map((cell) => formatCell(cell));
  return `| ${formatted.join(' | ')} |`;
}

/**
 * Converts a spreadsheet 2D array to a GitHub-flavoured markdown table string.
 *
 * The first row is treated as the header.  Each row is pipe-delimited with
 * leading and trailing pipes.  A separator row of `---` per column follows
 * the header.  Rows are joined by `\n` with no trailing newline.
 *
 * @param {SpreadsheetRows} rows - The spreadsheet rows where each cell may be a string, number,
 *               or null.
 * @returns {string} A GFM markdown table string, or `''` when the input is empty.
 */
export function spreadsheetToMarkdownTable(rows: SpreadsheetRows): string {
  if (rows.length === 0) {
    return '';
  }

  const columnCount = rows[0].length;

  const headerRow = buildRow(rows[0]);
  const separatorRow = `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`;
  const dataRows = rows.slice(1).map((row) => buildRow(row));

  return [headerRow, separatorRow, ...dataRows].join('\n');
}
