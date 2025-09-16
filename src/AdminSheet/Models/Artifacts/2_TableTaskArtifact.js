if (typeof module !== 'undefined') {
  // Required for testing in a Node.js environment with Vitest
  BaseTaskArtifact = require('./0_BaseTaskArtifact.js');
}

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
 *   - null -> returns null
 *   - string -> trimmed string, empty -> null
 *   - Array (rows) -> each cell is normalized via _normCell, trailing empty
 *     rows and fully-empty trailing columns are removed via _trimEmpty. If no
 *     rows remain, returns null. Otherwise sets this._rows and returns a
 *     Markdown table string produced by toMarkdown(trimmedRows).
 * - getRows() returns a shallow copy of the internal rows array (array of row
 *   arrays) to avoid external mutation of internal state.
 * - toMarkdown(rowsOverride) converts a rows array (or this.content if no
 *   override) into a Markdown table string with a header separator row. Invalid
 *   or empty input -> returns an empty string.
 *
 * Internal normalization helpers (prefixed with _) are private and mutate the
 * provided rows in-place where appropriate:
 * - _normCell(cell): numbers are kept, null/empty strings become null, other
 *   values are stringified and trimmed.
 * - _trimEmpty(rows): removes trailing empty rows and removes any trailing
 *   columns that are empty in every remaining row.
 * - _rowEmpty(row) / _cellEmpty(cell): utility predicates used by trimming.
 *
 * Notes:
 * - The class expects a BaseTaskArtifact superclass (not shown) that may
 *   provide construction and other shared behavior. The constructor is expected
 *   to accept an options object that may include a `content` property.
 * - _rows is an internal property (Array<Array<string|number|null>>) that is
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
 * @returns {string|null} Normalized Markdown string, or null when content is
 *                        considered empty/invalid.
 *
 * @method getRows
 * @returns {Array<Array<string|number|null>>} A copy of the internal rows
 *                                           representation (never null).
 *
 * @method _normCell
 * @private
 * @param {any} cell
 * @returns {string|number|null} Normalized cell value: numbers preserved,
 *                              trimmed strings, or null for empty.
 *
 * @method _trimEmpty
 * @private
 * @param {Array<Array<any>>} rows - Mutated in-place to remove empty rows/cols
 * @returns {Array<Array<any>>} The same rows array after trimming.
 *
 * @method _rowEmpty
 * @private
 * @param {Array<any>} row
 * @returns {boolean} True if all cells in the row are empty.
 *
 * @method _cellEmpty
 * @private
 * @param {any} cell
 * @returns {boolean} True if cell is null or empty string.
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
   * @returns {string|null}
   */
  normalizeContent(content) {
    if (content == null) return null;
    if (typeof content === 'string') {
      const s = content.trim();
      return s === '' ? null : s;
    }
    if (!Array.isArray(content)) return null;
    const rows = content.map((row) =>
      Array.isArray(row) ? row.map((cell) => this._normCell(cell)) : []
    );
    const trimmed = this._trimEmpty(rows);
    if (!trimmed.length) return null;
    this._rows = trimmed;
    return this.toMarkdown(trimmed);
  }
  /**
   * Return a shallow copy of the normalized rows.
   * @returns {Array<Array<any>>}
   */
  getRows() {
    if (this._rows && Array.isArray(this._rows)) return this._rows.map((r) => r.slice());
    return [];
  }
  /**
   * Normalize an individual cell value.
   * @private
   * @param {*} cell
   * @returns {string|number|null}
   */
  _normCell(cell) {
    if (cell == null) return null;
    if (typeof cell === 'number') return cell;
    let s = String(cell).trim();
    return s === '' ? null : s;
  }
  /**
   * Remove trailing empty rows and fully-empty trailing columns in-place.
   * @private
   * @param {Array<Array<any>>} rows
   * @returns {Array<Array<any>>}
   */
  _trimEmpty(rows) {
    while (rows.length && this._rowEmpty(rows[rows.length - 1])) rows.pop();
    if (rows.length) {
      let colCount = Math.max(...rows.map((r) => r.length));
      for (let c = colCount - 1; c >= 0; c--) {
        let allEmpty = true;
        for (let r = 0; r < rows.length; r++) {
          if (!this._cellEmpty(rows[r][c])) {
            allEmpty = false;
            break;
          }
        }
        if (allEmpty) {
          for (let r = 0; r < rows.length; r++) rows[r].splice(c, 1);
        }
      }
    }
    return rows;
  }
  /**
   * Predicate: is the row empty?
   * @private
   * @param {Array<any>} row
   * @returns {boolean}
   */
  _rowEmpty(row) {
    return !row.some((c) => !this._cellEmpty(c));
  }
  /**
   * Predicate: is the cell empty?
   * @private
   * @param {*} c
   * @returns {boolean}
   */
  _cellEmpty(c) {
    return c == null || c === '';
  }
  /**
   * Convert rows (or current content) into a Markdown table string.
   * @param {Array<Array<any>>} [rowsOverride]
   * @returns {string}
   */
  toMarkdown(rowsOverride) {
    const candidate = this && this.content !== undefined ? this.content : undefined;
    let src = rowsOverride !== undefined ? rowsOverride : candidate;
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
