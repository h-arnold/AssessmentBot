const ALPHABET_LENGTH = 26;
const ASCII_UPPERCASE_OFFSET = 64;
const NOT_FOUND_INDEX = -1;

/**
 * Provides a deliberately narrow equivalence check for spreadsheet formulae.
 *
 * This helper exists to avoid penalising students for choosing one of two
 * common spreadsheet idioms when both clearly express the same calculation:
 * summing a contiguous two-cell range with `SUM(...)`, or adding those same
 * two cells directly with `cell1+cell2`.
 *
 * The matcher is intentionally conservative. It does not try to evaluate full
 * spreadsheet formula semantics, simplify arbitrary expressions, or decide
 * whether two complex formulae are algebraically equivalent. It expects formula
 * strings to have already been canonicalised when the spreadsheet artifact was
 * created, and it only recognises the specific cases below from those stored
 * canonical forms:
 *
 * - `=SUM(A1:A2)` matches `=A1+A2`
 * - `=SUM(A1:B1)` matches `=A1+B1`
 * - `=A1+B1` matches `=B1+A1`
 *
 * The supported `SUM` form is restricted to a contiguous two-cell range on the
 * same sheet, either horizontal or vertical. Wider ranges, diagonal ranges,
 * nested expressions, literals, function calls inside additions, and mixed-sheet
 * ranges are all treated as unsupported and therefore do not match unless the
 * raw formula strings are already identical.
 */
class SpreadsheetFormulaEquivalence {
  /**
   * Determines whether two formulae should be treated as equivalent for
   * spreadsheet assessment.
   *
   * The method first honours exact string equality so existing canonicalised
   * formula matches remain cheap. When the raw strings differ it performs a
   * low-cost shape check before any regex work, so most unrelated formulae can
   * fall straight back to a normal mismatch without parsing.
   *
   * @param {string} studentFormula - Formula supplied by the student.
   * @param {string} referenceFormula - Formula from the reference material.
   * @return {boolean} Whether the formulae should be scored as matching.
   */
  static areEquivalent(studentFormula, referenceFormula) {
    if (studentFormula === referenceFormula) {
      return true;
    }

    if (!studentFormula || !referenceFormula) {
      return false;
    }

    if (!this._canUseSimpleAdditionEquivalence(studentFormula, referenceFormula)) {
      return false;
    }

    const studentSignature = this._getSimpleAdditionSignature(studentFormula);
    if (!studentSignature) {
      return false;
    }

    const referenceSignature = this._getSimpleAdditionSignature(referenceFormula);
    return referenceSignature === studentSignature;
  }

  /**
   * Performs a cheap structural pre-check before regex parsing.
   *
   * Supported equivalence only exists for direct two-cell addition and for a
   * `SUM(range)` form that might describe the same two cells. If neither side
   * contains a plus sign, or the non-addition side is clearly not a `SUM`
   * candidate, the helper can reject the pair immediately.
   *
   * @param {string} studentFormula - Student formula to inspect.
   * @param {string} referenceFormula - Reference formula to inspect.
   * @return {boolean} Whether the pair is worth attempting to parse.
   */
  static _canUseSimpleAdditionEquivalence(studentFormula, referenceFormula) {
    const studentHasPlus = studentFormula.indexOf('+') !== NOT_FOUND_INDEX;
    const referenceHasPlus = referenceFormula.indexOf('+') !== NOT_FOUND_INDEX;

    if (studentHasPlus && referenceHasPlus) {
      return true;
    }

    if (studentHasPlus) {
      return this._isSumCandidate(referenceFormula);
    }

    if (referenceHasPlus) {
      return this._isSumCandidate(studentFormula);
    }

    return false;
  }

  /**
   * Identifies whether a formula is cheaply worth testing as a `SUM` range.
   *
   * This does not validate the full structure; it only filters out obvious
   * non-candidates before the stricter regex-based parser runs.
   *
   * @param {string} formula - Formula string to inspect.
   * @return {boolean} Whether the formula looks like a possible `SUM(range)`.
   */
  static _isSumCandidate(formula) {
    return (
      formula.startsWith('=SUM(') &&
      formula.endsWith(')') &&
      formula.indexOf(':') !== NOT_FOUND_INDEX
    );
  }

  /**
   * Builds a stable comparison signature for the small set of supported
   * equivalent formula shapes.
   *
   * The signature collapses supported formulae to an order-independent pair of
   * parsed A1 references. That allows `=A1+B1` and `=B1+A1` to compare equal,
   * and allows either addition form to match a two-cell `SUM` range that spans
   * those same references.
   *
   * @param {string} formula - Formula string to inspect.
   * @return {string|null} Stable signature when the formula is supported, else null.
   */
  static _getSimpleAdditionSignature(formula) {
    const canonicalFormula = formula ? String(formula) : '';
    if (!canonicalFormula) {
      return null;
    }

    const rangeMatch = canonicalFormula.match(/^=SUM\(([^:()]+):([^:()]+)\)$/);
    if (rangeMatch) {
      const startReference = this._parseA1Reference(rangeMatch[1]);
      const endReference = this._parseA1Reference(rangeMatch[2]);
      return this._createTwoCellRangeSignature(startReference, endReference);
    }

    const additionMatch = canonicalFormula.match(/^=([^+()]+)\+([^+()]+)$/);
    if (!additionMatch) {
      return null;
    }

    const firstReference = this._parseA1Reference(additionMatch[1]);
    const secondReference = this._parseA1Reference(additionMatch[2]);
    if (!firstReference || !secondReference) {
      return null;
    }

    return this._buildReferencePairSignature([firstReference, secondReference]);
  }
  /**
   * Parses a simple A1 reference into sheet, row, and column coordinates.
   *
   * The parser accepts optional `$` anchors and an optional sheet prefix, but
   * only for a single-cell A1 reference. Anything more complex, such as named
   * ranges or nested expressions, is rejected so the caller can fall back to a
   * normal incorrect-formula comparison.
   *
   * @param {string} reference - Candidate A1 reference.
   * @return {Object|null} Parsed reference details, or null when unsupported.
   */
  static _parseA1Reference(reference) {
    const match = String(reference).match(/^(?:(.+)!)?(\$?[A-Z]+)(\$?\d+)$/);
    if (!match) {
      return null;
    }

    const sheetName = match[1] || '';
    const columnLetters = match[2].replace(/\$/g, '');
    const rowNumber = Number(match[3].replace(/\$/g, ''));
    if (!rowNumber) {
      return null;
    }

    let columnNumber = 0;
    for (let i = 0; i < columnLetters.length; i++) {
      columnNumber =
        columnNumber * ALPHABET_LENGTH + (columnLetters.charCodeAt(i) - ASCII_UPPERCASE_OFFSET);
    }

    return {
      sheetName,
      rowNumber,
      columnNumber,
    };
  }

  /**
   * Creates a signature for a supported two-cell `SUM` range.
   *
   * The range is only considered equivalent to direct addition when it spans
   * exactly two adjacent cells on the same row or the same column. This keeps
   * the matcher predictable and avoids broadening it into a general-purpose
   * formula simplifier.
   *
   * @param {Object|null} startReference - Parsed range start reference.
   * @param {Object|null} endReference - Parsed range end reference.
   * @return {string|null} Stable signature, or null when the range is unsupported.
   */
  static _createTwoCellRangeSignature(startReference, endReference) {
    if (!startReference || !endReference) {
      return null;
    }

    if (startReference.sheetName !== endReference.sheetName) {
      return null;
    }

    const sameRow = startReference.rowNumber === endReference.rowNumber;
    const sameColumn = startReference.columnNumber === endReference.columnNumber;
    if (sameRow === sameColumn) {
      return null;
    }

    if (sameRow && Math.abs(startReference.columnNumber - endReference.columnNumber) !== 1) {
      return null;
    }

    if (sameColumn && Math.abs(startReference.rowNumber - endReference.rowNumber) !== 1) {
      return null;
    }

    return this._buildReferencePairSignature([startReference, endReference]);
  }

  /**
   * Builds an order-independent signature for two parsed references.
   *
   * Sorting the pair means the helper treats `A1+B1` and `B1+A1` as equivalent
   * while still requiring both references to describe the same two cells.
   *
   * @param {Array<Object>} references - Parsed references to combine.
   * @return {string} Stable signature string.
   */
  static _buildReferencePairSignature(references) {
    return references
      .map((reference) => `${reference.sheetName}|${reference.rowNumber}|${reference.columnNumber}`)
      .sort()
      .join('::');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpreadsheetFormulaEquivalence;
} else {
  globalThis.SpreadsheetFormulaEquivalence = SpreadsheetFormulaEquivalence;
}
