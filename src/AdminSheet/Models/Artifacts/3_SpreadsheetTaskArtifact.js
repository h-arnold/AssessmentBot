if (typeof module !== 'undefined') {
  // Required for testing in a Node.js environment with Vitest
  BaseTaskArtifact = require('./0_BaseTaskArtifact.js');
}

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
   * are canonicalised (uppercase outside quoted regions).
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
    if (!trimmed.length) return null;
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
    while (rows.length && this._rowEmpty(rows[rows.length - 1])) rows.pop();
    if (rows.length) {
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
   * Canonicalise a formula string by uppercasing outside quoted literals.
   * @private
   * @param {string} f
   * @returns {string}
   */
  _canonicaliseFormula(f) {
    let result = '';
    let inQuote = false;
    for (const ch of String(f)) {
      if (ch === '"') {
        inQuote = !inQuote;
        result += ch;
        continue;
      }
      result += inQuote ? ch : ch.toUpperCase();
    }
    return result;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpreadsheetTaskArtifact;
} else {
  this.SpreadsheetTaskArtifact = SpreadsheetTaskArtifact;
}
