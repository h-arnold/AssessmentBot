if (typeof module !== 'undefined') {
  // Required for testing in a Node.js environment with Vitest
  BaseTaskArtifact = require('./0_BaseTaskArtifact.js');
}

const TABLE_MAX_ROWS = 50;
const TABLE_MAX_COLUMNS = 50;

/**
 * TableTaskArtifact
 *
 * Represents a table-style task artifact. It normalizes various input shapes
 * (null, string, or a 2D array of cells) into an internal rows representation
 * and can produce a Markdown table string.
 *
 * Behavior summary:
 * - getType() always returns the literal 'TABLE'.
 * - normalizeContent(content):
 *   - null -> throws after logging via ProgressTracker (fatal input)
 *   - string -> trimmed string, _rows cleared
 *   - Array (rows) -> cells normalised via _normCell, shape preserved (empty
 *     rows/columns retained) and padded to the widest row. Hard limit of 50x50
 *     enforced. Result stored in this._rows and returned as Markdown via
 *     toMarkdown.
 * - getRows() returns a shallow copy of the internal rows array (array of row
 *   arrays) to avoid external mutation of internal state.
 * - toMarkdown(rowsOverride) converts a rows array (or this.content if no
 *   override) into a Markdown table string with a header separator row. Invalid
 *   or empty input -> returns an empty string.
 *
 * Internal normalization helpers (prefixed with _) are private and mutate the
 * provided rows in-place where appropriate:
 * - _normCell(cell): numbers are kept, null/empty strings become empty string,
 *   other values are stringified and trimmed.
 *
 * Notes:
 * - The class expects a BaseTaskArtifact superclass (not shown) that may
 *   provide construction and other shared behavior. The constructor is expected
 *   to accept an options object that may include a `content` property.
 * - _rows is an internal property (Array<Array<string|number>>) that is
 *   set by normalizeContent when an array of rows is provided and accepted.
 *
 * @class
 * @extends BaseTaskArtifact
 *
 * @example
 * // Normalize raw cells into an artifact
 * const raw = [['Name', 'Score'], ['Alice', 10], ['Bob', null]];
 * const art = TableTaskArtifact.fromRawCells(raw, { id: 't1' });
 * // art.normalizeContent(...) will set art._rows and return a Markdown table
 *
 * @method getType
 * @returns {string} The artifact type literal: 'TABLE'.
 *
 * @method normalizeContent
 * @param {null|string|Array<Array<any>>} content - content to normalize
 * @returns {string} Normalized Markdown string.
 *
 * @method getRows
 * @returns {Array<Array<string|number>>} A copy of the internal rows
 *                                        representation (never null).
 *
 * @method _normCell
 * @private
 * @param {any} cell
 * @returns {string|number} Normalized cell value: numbers preserved,
 *                              trimmed strings, or empty string for empty.
 *
 * @method toMarkdown
 * @param {Array<Array<any>>} [rowsOverride] - optional rows to convert; when
 *                                            omitted, the instance's content
 *                                            is used (if present).
 * @returns {string} Markdown table string, or empty string for invalid input.
 *
 * @static
 * @method fromRawCells
 * @param {Array<Array<any>>} rawCells - raw 2D array of cells to use as content
 * @param {Object} [params] - additional params to pass to the constructor
 * @returns {TableTaskArtifact} New TableTaskArtifact instantiated with
 *                              { ...params, content: rawCells }.
 */
class TableTaskArtifact extends BaseTaskArtifact {
  /**
   * Return the artifact type identifier.
   * @returns {string}
   */
  getType() {
    return 'TABLE';
  }
  /**
   * Normalize table-like content into internal rows and return a Markdown
   * string representation. Accepts null, string, or 2D array input.
   * @param {null|string|Array<Array<any>>} content
   * @returns {string}
   */
  normalizeContent(content) {
    if (content == null) {
      const err = new Error('TableTaskArtifact.normalizeContent received null content');
      ProgressTracker.getInstance().logAndThrowError('Failed to normalise table content', {
        reason: 'content_null',
        err,
      });
    }
    if (typeof content === 'string') {
      const s = content.trim();
      this._rows = null;
      return s;
    }
    if (!Array.isArray(content)) {
      this._rows = null;
      return '';
    }

    if (content.length > TABLE_MAX_ROWS) {
      const err = new Error(
        `TableTaskArtifact.normalizeContent row limit exceeded: ${content.length} > ${TABLE_MAX_ROWS}`
      );
      ProgressTracker.getInstance().logAndThrowError('Failed to normalise table content', {
        reason: 'row_limit_exceeded',
        rowCount: content.length,
        maxRows: TABLE_MAX_ROWS,
        err,
      });
    }

    const normalisedRows = [];
    let widestRow = 0;
    for (let r = 0; r < content.length; r++) {
      const rawRow = Array.isArray(content[r]) ? content[r] : [];
      const normalisedRow = rawRow.map((cell) => this._normCell(cell));
      if (normalisedRow.length > TABLE_MAX_COLUMNS) {
        const err = new Error(
          `TableTaskArtifact.normalizeContent column limit exceeded on row ${r}: ${normalisedRow.length} > ${TABLE_MAX_COLUMNS}`
        );
        ProgressTracker.getInstance().logAndThrowError('Failed to normalise table content', {
          reason: 'column_limit_exceeded',
          rowIndex: r,
          columnCount: normalisedRow.length,
          maxColumns: TABLE_MAX_COLUMNS,
          err,
        });
      }
      widestRow = Math.max(widestRow, normalisedRow.length);
      normalisedRows.push(normalisedRow);
    }

    const targetWidth = Math.max(1, widestRow);
    if (!normalisedRows.length) {
      normalisedRows.push(new Array(targetWidth).fill(''));
    }

    const paddedRows = normalisedRows.map((row) => {
      if (row.length === targetWidth) return row;
      const padded = row.slice();
      while (padded.length < targetWidth) padded.push('');
      return padded;
    });

    this._rows = paddedRows;
    return this.toMarkdown(paddedRows);
  }
  /**
   * Return a shallow copy of the normalized rows.
   * @returns {Array<Array<string|number>>}
   */
  getRows() {
    if (this._rows && Array.isArray(this._rows)) return this._rows.map((r) => r.slice());
    return [];
  }
  /**
   * Normalize an individual cell value.
   * @private
   * @param {*} cell
   * @returns {string|number}
   */
  _normCell(cell) {
    if (cell == null) return '';
    if (typeof cell === 'number') return cell;
    return String(cell).trim();
  }
  /**
   * Convert rows (or current content) into a Markdown table string.
   * @param {Array<Array<any>>} [rowsOverride]
   * @returns {string}
   */
  toMarkdown(rowsOverride) {
    const candidate =
      rowsOverride !== undefined
        ? rowsOverride
        : this._rows && this._rows.length
        ? this._rows
        : this.content;
    let src = candidate;
    if (!src) return '';
    if (typeof src === 'string') return src.trim();
    if (!Array.isArray(src) || !src.length) return '';
    const header = src[0] || [];
    if (!Array.isArray(header)) return '';
    const lines = [];
    lines.push('| ' + header.map((c) => (c == null ? '' : String(c))).join(' | ') + ' |');
    lines.push('| ' + header.map(() => '---').join(' | ') + ' |');
    for (let i = 1; i < src.length; i++) {
      const row = Array.isArray(src[i]) ? src[i] : [];
      lines.push('| ' + row.map((c) => (c == null ? '' : String(c))).join(' | ') + ' |');
    }
    return lines.join('\n');
  }
  /**
   * Create a TableTaskArtifact from raw 2D cells.
   * @param {Array<Array<any>>} rawCells
   * @param {Object} params
   * @returns {TableTaskArtifact}
   */
  static fromRawCells(rawCells, params) {
    return new TableTaskArtifact({ ...params, content: rawCells });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TableTaskArtifact;
} else {
  this.TableTaskArtifact = TableTaskArtifact;
}
