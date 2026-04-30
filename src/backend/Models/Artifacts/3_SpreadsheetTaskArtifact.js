if (typeof module !== 'undefined') {
  // Required for testing in a Node.js environment with Vitest
  BaseTaskArtifact = require('./0_BaseTaskArtifact.js');
}

/**
 *
 */
class SpreadsheetTaskArtifact extends BaseTaskArtifact {
  /**
   * Return the artifact type identifier.
   * @returns {string}
   */
  getType() {
    return 'SPREADSHEET';
  }
  /**
   * Normalize spreadsheet-like content into a trimmed 2D array.
   * Strings are rejected (returns null). Formula strings starting with '='
   * are canonicalised at artifact-creation time so later comparison logic can
   * rely on a stable stored representation instead of re-normalising during
   * assessment.
   * @param {Array<Array<any>>|null} content
   * @returns {Array<Array<any>>|null}
   */
  normalizeContent(content) {
    if (content == null) return null;
    if (Validate.isString(content)) return null;
    if (!Array.isArray(content)) return null;
    const rows = content.map((row) =>
      Array.isArray(row) ? row.map((cell) => this._normCell(cell)) : []
    );
    const trimmed = this._trimEmpty(rows);
    if (trimmed.length === 0) return null;
    for (const row of trimmed) {
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (Validate.isString(cell) && cell.startsWith('=')) {
          row[c] = this._canonicaliseFormula(cell);
        }
      }
    }
    return trimmed;
  }
  /**
   * Normalize an individual spreadsheet cell.
   * @private
   * @param {*} cell
   * @returns {string|number|null}
   */
  _normCell(cell) {
    if (cell == null) return null;
    if (typeof cell === 'number') return cell;
    const s = String(cell).trim();
    return s === '' ? null : s;
  }
  /**
   * Trim trailing empty rows and fully-empty trailing columns.
   * @private
   * @param {Array<Array<any>>} rows
   * @returns {Array<Array<any>>}
   */
  _trimEmpty(rows) {
    while (rows.length > 0 && this._rowEmpty(rows.at(-1))) rows.pop();
    if (rows.length > 0) {
      let colCount = Math.max(...rows.map((r) => r.length));
      for (let c = colCount - 1; c >= 0; c--) {
        let allEmpty = true;
        for (const row of rows) {
          const v = row[c];
          if (!(v == null || v === '')) {
            allEmpty = false;
            break;
          }
        }
        if (allEmpty) {
          for (const row of rows) row.splice(c, 1);
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
    return !row.some((c) => !(c == null || c === ''));
  }
  /**
   * Canonicalise a formula string for consistent spreadsheet comparison.
   * Preserves text inside quoted literals, strips spaces elsewhere, and
   * uppercases the remaining text.
   * Space stripping outside quotes is intentional so Google Sheets-equivalent
   * entries like `=SUM (A1:C10)` and `=SUM(A1:C10)` are treated the same.
   * This is the single normalisation point for spreadsheet formula content,
   * including formulae that may later be checked for supported equivalence.
   * @private
   * @param {string} f
   * @returns {string}
   */
  _canonicaliseFormula(f) {
    if (!f) return f;

    const formula = String(f);

    let result = '';
    let inDoubleQuote = false;
    let inSingleQuote = false;
    for (let i = 0; i < formula.length; i++) {
      const ch = formula.charAt(i);
      if (ch === '"') {
        if (inDoubleQuote && i + 1 < formula.length && formula.charAt(i + 1) === '"') {
          result += '""';
          i++;
          continue;
        }
        if (!inSingleQuote) inDoubleQuote = !inDoubleQuote;
        result += ch;
        continue;
      }

      if (ch === "'") {
        if (!inDoubleQuote) inSingleQuote = !inSingleQuote;
        result += ch;
        continue;
      }

      if (inDoubleQuote || inSingleQuote) {
        result += ch;
        continue;
      }

      if (ch !== ' ') {
        result += ch.toUpperCase();
      }
    }
    return result;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpreadsheetTaskArtifact;
} else {
  this.SpreadsheetTaskArtifact = SpreadsheetTaskArtifact;
}
