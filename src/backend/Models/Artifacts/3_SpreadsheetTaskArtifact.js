if (typeof module !== 'undefined') {
  // Required for testing in a Node.js environment with Vitest
  BaseTaskArtifact = require('./0_BaseTaskArtifact.js');
}

const LAST_ROW_INDEX = -1;

/**
 *
 */
class SpreadsheetTaskArtifact extends BaseTaskArtifact {
  /**
   * Return the artifact type identifier.
   *
   * @returns {string} The artifact type identifier.
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
   *
   * @param {Array<Array<any>>|null} content - Spreadsheet content to normalise.
   * @returns {Array<Array<any>>|null} Normalised rows.
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
   *
   * @private
   * @param {*} cell - Cell value to normalise.
   * @returns {string|number|null} Normalised cell value.
   */
  _normCell(cell) {
    if (cell == null) return null;
    if (typeof cell === 'number') return cell;
    const s = String(cell).trim();
    return s === '' ? null : s;
  }
  /**
   * Trim trailing empty rows and fully-empty columns.
   *
   * @private
   * @param {Array<Array<any>>} rows - Rows to trim.
   * @returns {Array<Array<any>>} Trimmed rows.
   */
  _trimEmpty(rows) {
    while (rows.length > 0 && this._rowEmpty(rows.at(LAST_ROW_INDEX))) rows.pop();
    if (rows.length > 0) this._trimEmptyColumns(rows);
    return rows;
  }
  /**
   * Remove trailing columns whose cells are empty in every remaining row.
   *
   * @private
   * @param {Array<Array<any>>} rows - Rows whose columns may be empty.
   */
  _trimEmptyColumns(rows) {
    const colCount = Math.max(...rows.map((row) => row.length));
    let trimmedColCount = colCount;
    while (
      trimmedColCount > 0 &&
      rows.every((row) => row[trimmedColCount - 1] == null || row[trimmedColCount - 1] === '')
    ) {
      trimmedColCount--;
    }
    for (const row of rows) row.length = trimmedColCount;
  }
  /**
   * Predicate: is the row empty?
   *
   * @private
   * @param {Array<any>} row - Row to check.
   * @returns {boolean} True when the row is empty.
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
   *
   * @private
   * @param {string} formula - Formula string to canonicalise.
   * @returns {string} Canonicalised formula.
   */
  _canonicaliseFormula(formula) {
    if (!formula) return formula;

    const formulaText = String(formula);
    const state = { result: '', inDoubleQuote: false, inSingleQuote: false, skipNext: false };
    for (let index = 0; index < formulaText.length; index++) {
      if (state.skipNext) {
        state.skipNext = false;
        continue;
      }
      this._canonicaliseFormulaCharacter(formulaText, index, state);
    }
    return state.result;
  }
  /**
   * Process one character while canonicalising a formula.
   *
   * @private
   * @param {string} formula - Full formula text.
   * @param {number} index - Current character index.
   * @param {{result: string, inDoubleQuote: boolean, inSingleQuote: boolean, skipNext: boolean}} state - Mutable parsing state.
   * @returns {void}
   */
  _canonicaliseFormulaCharacter(formula, index, state) {
    const character = formula.charAt(index);
    if (character === '"') return this._canonicaliseDoubleQuote(formula, index, state);
    if (character === "'") return this._canonicaliseSingleQuote(character, state);
    if (state.inDoubleQuote || state.inSingleQuote) {
      state.result += character;
      return;
    }
    if (character !== ' ') state.result += character.toUpperCase();
  }
  /**
   * Preserve a double quote, including escaped quotes within a quoted literal.
   *
   * @private
   * @param {string} formula - Full formula text.
   * @param {number} index - Current character index.
   * @param {{result: string, inDoubleQuote: boolean, inSingleQuote: boolean, skipNext: boolean}} state - Mutable parsing state.
   */
  _canonicaliseDoubleQuote(formula, index, state) {
    if (state.inDoubleQuote && formula.charAt(index + 1) === '"') {
      state.result += '""';
      state.skipNext = true;
      return;
    }
    if (!state.inSingleQuote) state.inDoubleQuote = !state.inDoubleQuote;
    state.result += '"';
  }
  /**
   * Preserve a single quote and track its quoted literal.
   *
   * @private
   * @param {string} character - Single quote character.
   * @param {{result: string, inDoubleQuote: boolean, inSingleQuote: boolean, skipNext: boolean}} state - Mutable parsing state.
   */
  _canonicaliseSingleQuote(character, state) {
    if (!state.inDoubleQuote) state.inSingleQuote = !state.inSingleQuote;
    state.result += character;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpreadsheetTaskArtifact;
} else {
  globalThis.SpreadsheetTaskArtifact = SpreadsheetTaskArtifact;
}
