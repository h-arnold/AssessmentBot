const ALPHABET_LENGTH = 26;
const ASCII_UPPERCASE_OFFSET = 64;
const NOT_FOUND_INDEX = -1;

/**
 * Provides a deliberately narrow equivalence check for spreadsheet formulae.
 */
const SpreadsheetFormulaEquivalence = {
  /**
   * Determines whether two formulae should be treated as equivalent for
   * spreadsheet assessment.
   * @param {string} studentFormula - Formula supplied by the student.
   * @param {string} referenceFormula - Formula from the reference material.
   * @returns {boolean} Whether the formulae should be scored as matching.
   */
  areEquivalent(studentFormula, referenceFormula) {
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
  },

  /**
   * Performs a cheap structural pre-check before regex parsing.
   * @param {string} studentFormula - Student formula to inspect.
   * @param {string} referenceFormula - Reference formula to inspect.
   * @returns {boolean} Whether the pair is worth attempting to parse.
   */
  _canUseSimpleAdditionEquivalence(studentFormula, referenceFormula) {
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
  },

  /**
   * Identifies whether a formula is cheaply worth testing as a SUM range.
   * @param {string} formula - Formula string to inspect.
   * @returns {boolean} Whether the formula looks like a possible SUM(range).
   */
  _isSumCandidate(formula) {
    return (
      formula.startsWith('=SUM(') &&
      formula.endsWith(')') &&
      formula.indexOf(':') !== NOT_FOUND_INDEX
    );
  },

  /**
   * Builds a stable comparison signature for the supported equivalent shapes.
   * @param {string} formula - Formula string to inspect.
   * @returns {string|null} Stable signature when the formula is supported, else null.
   */
  _getSimpleAdditionSignature(formula) {
    const canonicalFormula = formula ? String(formula) : '';
    if (!canonicalFormula) {
      return null;
    }

    const rangeRegex = /^=SUM\(([^():]+):([^():]+)\)$/u;
    const rangeMatch = rangeRegex.exec(canonicalFormula);
    if (rangeMatch) {
      const startReference = this._parseA1Reference(rangeMatch[1]);
      const endReference = this._parseA1Reference(rangeMatch[2]);
      return this._createTwoCellRangeSignature(startReference, endReference);
    }

    const additionRegex = /^=([^()+]+)\+([^()+]+)$/u;
    const additionMatch = additionRegex.exec(canonicalFormula);
    if (!additionMatch) {
      return null;
    }

    const firstReference = this._parseA1Reference(additionMatch[1]);
    const secondReference = this._parseA1Reference(additionMatch[2]);
    if (!firstReference || !secondReference) {
      return null;
    }

    return this._buildReferencePairSignature([firstReference, secondReference]);
  },

  /**
   * Parses a simple A1 reference into sheet, row, and column coordinates.
   * @param {string} reference - Candidate A1 reference.
   * @returns {Object|null} Parsed reference details, or null when unsupported.
   */
  _parseA1Reference(reference) {
    const text = String(reference);
    if (!text) {
      return null;
    }

    let sheetName = '';
    let cellReference = text;
    const sheetSeparatorIndex = text.lastIndexOf('!');
    if (sheetSeparatorIndex !== NOT_FOUND_INDEX) {
      sheetName = text.slice(0, sheetSeparatorIndex);
      cellReference = text.slice(sheetSeparatorIndex + 1);
      if (!sheetName || !cellReference) {
        return null;
      }
    }

    let index = 0;
    if (cellReference.charAt(index) === '$') {
      index++;
    }

    let columnLetters = '';
    while (index < cellReference.length) {
      const codePoint = cellReference.codePointAt(index);
      if (codePoint < 65 || codePoint > 90) {
        break;
      }
      columnLetters += cellReference.charAt(index);
      index++;
    }

    if (!columnLetters) {
      return null;
    }

    if (cellReference.charAt(index) === '$') {
      index++;
    }

    const rowPart = cellReference.slice(index);
    if (!rowPart || !/^\d+$/u.test(rowPart)) {
      return null;
    }

    const rowNumber = Number(rowPart);
    if (!rowNumber) {
      return null;
    }

    let columnNumber = 0;
    for (let index = 0; index < columnLetters.length; index++) {
      columnNumber =
        columnNumber * ALPHABET_LENGTH +
        (columnLetters.codePointAt(index) - ASCII_UPPERCASE_OFFSET);
    }

    return {
      sheetName,
      rowNumber,
      columnNumber,
    };
  },

  /**
   * Creates a signature for a supported two-cell SUM range.
   * @param {Object|null} startReference - Parsed range start reference.
   * @param {Object|null} endReference - Parsed range end reference.
   * @returns {string|null} Stable signature, or null when the range is unsupported.
   */
  _createTwoCellRangeSignature(startReference, endReference) {
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
  },

  /**
   * Builds an order-independent signature for two parsed references.
   * @param {Array<Object>} references - Parsed references to combine.
   * @returns {string} Stable signature string.
   */
  _buildReferencePairSignature(references) {
    return references
      .map((reference) => `${reference.sheetName}|${reference.rowNumber}|${reference.columnNumber}`)
      .toSorted((left, right) => left.localeCompare(right))
      .join('::');
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpreadsheetFormulaEquivalence;
} else {
  globalThis.SpreadsheetFormulaEquivalence = SpreadsheetFormulaEquivalence;
}
