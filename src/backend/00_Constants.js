/**
 * Shared backend constants that must be declared once in the GAS bundle.
 *
 * `ALPHABET_LENGTH` is referenced by `src/backend/Utils/Utils.js` and
 * `src/backend/Assessors/0_SpreadsheetFormulaEquivalence.js`, so the test
 * harness loads this file first to keep one declaration sufficient.
 */
const ALPHABET_LENGTH = 26;
const ITEM_NOT_FOUND_INDEX = -1;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ALPHABET_LENGTH,
    ITEM_NOT_FOUND_INDEX,
  };
}
