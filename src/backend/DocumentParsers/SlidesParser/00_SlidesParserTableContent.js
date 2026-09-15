/**
 * SlidesParserTableContent
 *
 * Content-extraction support for SlidesParser. Owns shape text reads, raw
 * table cell reads, and definition-content dispatch shared by the definition
 * and submission phases. The SlidesParser facade injects itself so helpers
 * stay focused on a single concern.
 */
/* global Validate, ABLogger, SlidesApp */

/**
 *
 */
class SlidesParserTableContent {
  /**
   * Creates the helper with its owning parser.
   * @param {Object} dependencies - Injected dependencies.
   * @param {SlidesParser} dependencies.parser - Owning parser facade.
   */
  constructor({ parser }) {
    this.parser = parser;
  }

  /**
   * Extracts content details or null when the element type is unsupported.
   * Internal reads route through the facade so subclass overrides and
   * facade spies remain observable (pre-decomposition dispatch contract).
   * @param {GoogleAppsScript.Slides.PageElement} pageElement - Tagged element.
   * @param {Object} context - Extraction context (documentId, pageId, taskTitle, elementType).
   * @returns {{artifactType: string, elementContent: *}|null} - Details or null.
   */
  extractDefinitionContent(pageElement, context) {
    const elementType = context.elementType ?? pageElement.getPageElementType();
    if (elementType === SlidesApp.PageElementType.SHAPE) {
      return {
        artifactType: 'TEXT',
        elementContent: this.parser.extractTextFromShape(pageElement.asShape()),
      };
    }
    if (elementType === SlidesApp.PageElementType.TABLE) {
      return {
        artifactType: 'TABLE',
        elementContent: this.parser.extractTableCells(pageElement.asTable(), context),
      };
    }
    return null;
  }

  /**
   * Returns the slide ID.
   * @param {GoogleAppsScript.Slides.Slide} slide - Slide object.
   * @returns {string} - Slide ID.
   */
  getPageId(slide) {
    return slide.getObjectId();
  }

  /**
   * Extracts trimmed text from a shape.
   * @param {GoogleAppsScript.Slides.Shape} shape - Shape element.
   * @returns {string} - Trimmed text.
   */
  extractTextFromShape(shape) {
    const text = shape.getText().asString();
    return text.trim();
  }

  /**
   * Extracts raw 2D cells; merged non-head cells return '' and span semantics are lost.
   * Failures log with document/page/task/row/column context and rethrow, so a
   * transient Slides failure is never stored as a legitimate empty table.
   * Cell reads route through the facade to preserve the dispatch contract.
   * @param {GoogleAppsScript.Slides.Table} table - Table element.
   * @param {Object} context - Extraction context (documentId, pageId, taskTitle).
   * @returns {Array} - Trimmed cell values.
   */
  extractTableCells(table, context) {
    Validate.requireParams({ context }, 'SlidesParser.extractTableCells');
    let numberRows;
    let numberCols;
    const rows = [];
    // Unset until iteration begins so dimension-read failures cannot be
    // mistaken for a first-cell failure in the contextual log.
    let currentRow = null;
    let currentColumn = null;
    let mergedCellCount = 0;
    try {
      numberRows = table.getNumRows();
      numberCols = table.getNumColumns();
      for (currentRow = 0; currentRow < numberRows; currentRow++) {
        const row = [];
        for (currentColumn = 0; currentColumn < numberCols; currentColumn++) {
          const cell = table.getCell(currentRow, currentColumn);
          const mergeState = cell.getMergeState();
          if (mergeState === SlidesApp.CellMergeState.MERGED) mergedCellCount++;
          row.push(this.parser.extractCellText(cell, mergeState));
        }
        rows.push(row);
      }
    } catch (error) {
      ABLogger.getInstance().error('extractTableCells failed', {
        documentId: context.documentId ?? null,
        pageId: context.pageId ?? null,
        taskTitle: context.taskTitle ?? null,
        row: currentRow,
        column: currentColumn,
        error,
      });
      throw error;
    }
    if (mergedCellCount > 0) {
      ABLogger.getInstance().debug('Merged cells skipped in table extraction', {
        mergedCellCount,
        pageId: context.pageId ?? null,
      });
    }
    return rows;
  }

  /**
   * Extracts trimmed cell text, or '' for merged non-head cells.
   * @param {GoogleAppsScript.Slides.TableCell} cell - Cell element.
   * @param {string} mergeState - Pre-resolved merge state from the table loop.
   * @returns {string} - Trimmed text or ''.
   */
  extractCellText(cell, mergeState) {
    Validate.requireParams({ cell, mergeState }, 'SlidesParser.extractCellText');
    if (mergeState === SlidesApp.CellMergeState.MERGED) {
      return '';
    }
    const text = cell.getText().asString();
    return text.trim();
  }
}

if (typeof module !== 'undefined') {
  module.exports = SlidesParserTableContent;
}
