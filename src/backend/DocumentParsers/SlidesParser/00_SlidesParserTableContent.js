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
   * @param {Object} context - Extraction context (documentId, pageId, taskTitle, elementType, readMode).
   * @param {'submission'|undefined} [context.readMode] - Opts native reads into student conversion; omitted keeps definition semantics.
   * @returns {{artifactType: string, elementContent: *}|null} - Details or null; `elementContent` may be null for unavailable student content.
   * @remarks In definition mode, native failures throw. In student mode, an ordinary native Error becomes null content, while TypeError, ReferenceError and non-Error values propagate unchanged.
   */
  extractDefinitionContent(pageElement, context) {
    const elementType = context.elementType ?? pageElement.getPageElementType();
    if (elementType === SlidesApp.PageElementType.SHAPE) {
      return {
        artifactType: 'TEXT',
        elementContent: this.parser.extractTextFromShape(pageElement.asShape(), context),
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
   * @param {Object} context - Optional extraction context (documentId, pageId, taskId, taskTitle, readMode).
   * @param {'submission'|undefined} [context.readMode] - Opts the native text read into student conversion; omitted keeps definition semantics.
   * @returns {string|null} - Trimmed text, or null when a student-mode read is unavailable.
   * @remarks Only an ordinary Error in student mode converts, with one diagnostic. TypeError, ReferenceError and non-Error values propagate without a conversion diagnostic; definition-mode failures throw without a local diagnostic.
   */
  extractTextFromShape(shape, context) {
    let text;
    try {
      text = shape.getText().asString();
    } catch (error) {
      if (
        context?.readMode === 'submission' &&
        error instanceof Error &&
        !(error instanceof TypeError) &&
        !(error instanceof ReferenceError)
      ) {
        ABLogger.getInstance().error('extractTextFromShape failed', {
          documentId: context.documentId ?? null,
          pageId: context.pageId ?? null,
          taskId: context.taskId ?? null,
          taskTitle: context.taskTitle ?? null,
          error,
        });
        return null;
      }
      throw error;
    }
    return text.trim();
  }

  /**
   * Extracts raw 2D cells; merged non-head cells return '' and span semantics are lost.
   * Cell reads route through the facade to preserve the dispatch contract.
   * @param {GoogleAppsScript.Slides.Table} table - Table element.
   * @param {Object} context - Extraction context (documentId, pageId, taskId, taskTitle, readMode).
   * @param {'submission'|undefined} [context.readMode] - Opts native reads into student conversion; omitted keeps definition semantics.
   * @returns {Array|null} - Trimmed cell values, or null when student table content is unavailable.
   * @remarks The first failing cell aborts the whole table with null, never a partial or blank table. Student ordinary native Errors convert with one first-failure diagnostic; TypeError, ReferenceError and non-Error values propagate. Definition-mode failures log once with context and rethrow.
   */
  extractTableCells(table, context) {
    Validate.requireParams({ context }, 'SlidesParser.extractTableCells');
    const dimensions = this._readTableDimensions(table, context);
    if (dimensions === null) return null;
    const extractedRows = [];
    let mergedCellCount = 0;
    for (let rowIndex = 0; rowIndex < dimensions.rows; rowIndex++) {
      const row = this._readTableRow(table, rowIndex, dimensions.columns, context);
      if (row === null) return null;
      mergedCellCount += row.mergedCellCount;
      extractedRows.push(row.cells);
    }
    if (mergedCellCount > 0) {
      ABLogger.getInstance().debug('Merged cells skipped in table extraction', {
        mergedCellCount,
        pageId: context.pageId ?? null,
      });
    }
    return extractedRows;
  }

  /**
   * Reads native table dimensions, converting only ordinary submission read failures.
   * @param {GoogleAppsScript.Slides.Table} table - Table element.
   * @param {Object} context - Extraction context.
   * @returns {{rows: number, columns: number}|null} - Dimensions or unavailable marker.
   * @remarks Student conversion logs once with null row/column coordinates; definition failures log once and rethrow; student guard failures propagate without a log.
   * @private
   */
  _readTableDimensions(table, context) {
    let rows;
    let columns;
    try {
      rows = table.getNumRows();
      columns = table.getNumColumns();
    } catch (error) {
      if (this._isConvertibleSubmissionRead(error, context)) {
        this._logTableReadFailure(context, error, null, null, true);
        return null;
      }
      if (context?.readMode !== 'submission') {
        this._logTableReadFailure(context, error, null, null, false);
      }
      throw error;
    }
    return { rows, columns };
  }

  /**
   * Reads one row; null means the whole table has unavailable student content.
   * @param {GoogleAppsScript.Slides.Table} table - Table element.
   * @param {number} rowIndex - Row index.
   * @param {number} columnCount - Number of columns.
   * @param {Object} context - Extraction context.
   * @returns {{cells: Array, mergedCellCount: number}|null} - Read row or unavailable marker.
   * @private
   */
  _readTableRow(table, rowIndex, columnCount, context) {
    const cells = [];
    let mergedCellCount = 0;
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
      const cellResult = this._readTableCell(table, rowIndex, columnIndex, context);
      if (cellResult === null) return null;
      cells.push(cellResult.text);
      mergedCellCount += cellResult.mergedCellCount;
    }
    return { cells, mergedCellCount };
  }

  /**
   * Reads a cell's merge state and text using narrow native-operation catches.
   * @param {GoogleAppsScript.Slides.Table} table - Table element.
   * @param {number} rowIndex - Row index.
   * @param {number} columnIndex - Column index.
   * @param {Object} context - Extraction context.
   * @returns {{text: string, mergedCellCount: number}|null} - Cell or unavailable marker.
   * @remarks In student mode, a literal null returned by `getCell` becomes unavailable content with a diagnostic TypeError; in definition mode it dereferences and throws. An actually thrown TypeError, ReferenceError or non-Error value is a guard and propagates unchanged.
   * @private
   */
  _readTableCell(table, rowIndex, columnIndex, context) {
    let cell;
    try {
      cell = table.getCell(rowIndex, columnIndex);
    } catch (error) {
      if (this._isConvertibleSubmissionRead(error, context)) {
        this._logTableReadFailure(context, error, rowIndex, columnIndex, true);
        return null;
      }
      if (context?.readMode !== 'submission') {
        this._logTableReadFailure(context, error, rowIndex, columnIndex, false);
      }
      throw error;
    }
    if (cell === null && context?.readMode === 'submission') {
      const error = new TypeError('Slides table returned a null cell.');
      this._logTableReadFailure(context, error, rowIndex, columnIndex, true);
      return null;
    }
    let mergeState;
    try {
      mergeState = cell.getMergeState();
    } catch (error) {
      if (this._isConvertibleSubmissionRead(error, context)) {
        this._logTableReadFailure(context, error, rowIndex, columnIndex, true);
        return null;
      }
      if (context?.readMode !== 'submission') {
        this._logTableReadFailure(context, error, rowIndex, columnIndex, false);
      }
      throw error;
    }
    const text = this._readCellText(cell, mergeState, rowIndex, columnIndex, context);
    if (text === null) return null;
    return {
      text,
      mergedCellCount: mergeState === SlidesApp.CellMergeState.MERGED ? 1 : 0,
    };
  }

  /**
   * Keeps facade dispatch/bookkeeping outside the native text-read catch.
   * @param {GoogleAppsScript.Slides.TableCell} cell - Table cell.
   * @param {string} mergeState - Resolved merge state.
   * @param {number} rowIndex - Row index.
   * @param {number} columnIndex - Column index.
   * @param {Object} context - Extraction context.
   * @returns {string|null} - Cell text or unavailable marker.
   * @remarks A null return means the facade already classified student content as unavailable; it is not a blank cell. Definition-mode failures log once and rethrow.
   * @private
   */
  _readCellText(cell, mergeState, rowIndex, columnIndex, context) {
    let text;
    try {
      text = this.parser.extractCellText(cell, mergeState, {
        ...context,
        row: rowIndex,
        column: columnIndex,
      });
    } catch (error) {
      if (context?.readMode !== 'submission') {
        this._logTableReadFailure(context, error, rowIndex, columnIndex, false);
      }
      throw error;
    }
    return text;
  }

  /**
   * Identifies ordinary Error instances that the student boundary owns.
   * @param {*} error - Native read failure.
   * @param {Object} context - Extraction context.
   * @returns {boolean} - Whether this is a convertible student read.
   * @private
   */
  _isConvertibleSubmissionRead(error, context) {
    return (
      context?.readMode === 'submission' &&
      error instanceof Error &&
      !(error instanceof TypeError) &&
      !(error instanceof ReferenceError)
    );
  }

  /**
   * Emits the single table-boundary diagnostic.
   * @param {Object} context - Extraction context.
   * @param {*} error - Original or null-cell failure evidence.
   * @param {number|null} row - Failed row.
   * @param {number|null} column - Failed column.
   * @param {boolean} hasTaskId - Whether submission task context is included.
   * @returns {void}
   * @private
   */
  _logTableReadFailure(context, error, row, column, hasTaskId) {
    const metadata = {
      documentId: context.documentId ?? null,
      pageId: context.pageId ?? null,
      taskTitle: context.taskTitle ?? null,
      row,
      column,
      error,
    };
    if (hasTaskId) metadata.taskId = context.taskId ?? null;
    ABLogger.getInstance().error('extractTableCells failed', metadata);
  }

  /**
   * Extracts trimmed cell text, or '' for merged non-head cells.
   * @param {GoogleAppsScript.Slides.TableCell} cell - Cell element.
   * @param {string} mergeState - Pre-resolved merge state from the table loop.
   * @param {Object} context - Optional extraction context (documentId, pageId, taskId, taskTitle, row, column, readMode).
   * @param {'submission'|undefined} [context.readMode] - Opts the native text read into student conversion; omitted keeps definition semantics.
   * @returns {string|null} - Trimmed text, '' for merged cells, or null when student content is unavailable.
   * @remarks Only an ordinary Error in student mode converts, with one diagnostic. TypeError, ReferenceError and non-Error values propagate without a conversion diagnostic; definition-mode failures propagate to the table boundary, which logs once.
   */
  extractCellText(cell, mergeState, context) {
    Validate.requireParams({ cell, mergeState }, 'SlidesParser.extractCellText');
    if (mergeState === SlidesApp.CellMergeState.MERGED) {
      return '';
    }
    let text;
    try {
      text = cell.getText().asString();
    } catch (error) {
      if (
        context?.readMode === 'submission' &&
        error instanceof Error &&
        !(error instanceof TypeError) &&
        !(error instanceof ReferenceError)
      ) {
        ABLogger.getInstance().error('extractTableCells failed', {
          documentId: context.documentId ?? null,
          pageId: context.pageId ?? null,
          taskId: context.taskId ?? null,
          taskTitle: context.taskTitle ?? null,
          row: context.row ?? null,
          column: context.column ?? null,
          error,
        });
        return null;
      }
      throw error;
    }
    return text.trim();
  }
}

if (typeof module !== 'undefined') {
  module.exports = SlidesParserTableContent;
}
