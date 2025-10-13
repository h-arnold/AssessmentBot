/**
 * SlidesParser Class
 *
 * Handles extraction and processing of content from Google Slides presentations.
 * Generates slide export URLs.
 * Handles per-document rate limiting.
 */
class SlidesParser extends DocumentParser {
  /**
   * Generates a slide export URL for a given slide in a Google Slides presentation.
   * @param {string} documentId - The ID of the Google Slides presentation.
   * @param {string} pageId - The ID of the specific slide within the presentation.
   * @return {string} - The URL to export the slide as an image.
   */
  generateSlideImageUrl(documentId, pageId) {
    const url = `https://docs.google.com/presentation/d/${documentId}/export/png?id=${documentId}&pageid=${pageId}`;

    if (Utils.isValidUrl(url)) {
      return url;
    } else {
      throw new Error(`Invalid URL produced.`);
    }
  }

  /**
   * Build TaskDefinitions from reference/template slide decks.
   * Tags:
   *   #TitleElement  (shape/table) -> creates/updates TaskDefinition
   *   ^NotesElement  -> attaches taskNotes
   *   ~ImageId       -> adds Image artifact using slide export URL
   * Page ordering establishes TaskDefinition.index.
   */
  extractTaskDefinitions(referenceDocumentId, templateDocumentId) {
    const referencePresentation = SlidesApp.openById(referenceDocumentId);
    const templatePresentation = templateDocumentId ? SlidesApp.openById(templateDocumentId) : null;
    const referenceSlides = referencePresentation.getSlides();
    const templateSlides = templatePresentation ? templatePresentation.getSlides() : [];

    // Map: key = title + '|' + pageId (slide id) for stability
    const definitionMap = new Map();
    let order = 0;

    const processSlides = (slides, role) => {
      slides.forEach((slide) => {
        const pageId = this.getPageId(slide);
        const pageElements = slide.getPageElements();
        pageElements.forEach((pageElement) => {
          const description = pageElement.getDescription();
          if (!description?.length) return;
          const tag = description.charAt(0);
          const tagText = description.substring(1).trim();
          switch (tag) {
            case '#': {
              // title element -> create/find TaskDefinition
              const taskTitle = tagText;
              const definitionKey = taskTitle + '|' + pageId;
              let definition = definitionMap.get(definitionKey);
              if (!definition) {
                definition = new TaskDefinition({ taskTitle, pageId });
                definition.index = order++;
                definitionMap.set(definitionKey, definition);
              }
              // Extract content (text/table) as primitive
              let elementContent = '';
              const elementType = pageElement.getPageElementType();
              if (elementType === SlidesApp.PageElementType.SHAPE) {
                elementContent = this.extractTextFromShape(pageElement.asShape());
              } else if (elementType === SlidesApp.PageElementType.TABLE) {
                // Return raw 2D cell array so TableTaskArtifact can normalise instead of markdown string
                elementContent = this.extractTableCells(pageElement.asTable());
                artifactType = 'TABLE';
              } else {
                return;
              }
              if (role === 'reference') {
                definition.addReferenceArtifact({
                  type: artifactType,
                  pageId,
                  content: elementContent,
                  taskIndex: definition.index,
                });
              } else if (role === 'template') {
                definition.addTemplateArtifact({
                  type: artifactType,
                  pageId,
                  content: elementContent,
                  taskIndex: definition.index,
                });
              }
              break;
            }
            case '^': {
              // notes
              // Attach to existing definition matching same page by last created definition with pageId
              // Simpler: find any definition with pageId (rare multiple) and append notes
              for (const definition of definitionMap.values()) {
                if (definition.pageId === pageId) {
                  const notesContent = this.extractTextFromPageElement(pageElement);
                  definition.taskNotes =
                    (definition.taskNotes ? definition.taskNotes + '\n' : '') + notesContent;
                }
              }
              break;
            }
            case '~':
            case '|': {
              // image artifact for whole slide
              const taskTitle = tagText; // image title key
              const definitionKey = taskTitle + '|' + pageId;
              let definition = definitionMap.get(definitionKey);
              if (!definition) {
                definition = new TaskDefinition({ taskTitle, pageId });
                definition.index = order++;
                definitionMap.set(definitionKey, definition);
              }
              const url = this.generateSlideImageUrl(
                role === 'reference' ? referenceDocumentId : templateDocumentId,
                pageId
              );
              const params = {
                type: 'IMAGE',
                pageId,
                metadata: { sourceUrl: url },
                content: null,
                taskIndex: definition.index,
              };
              if (role === 'reference') definition.addReferenceArtifact(params);
              else definition.addTemplateArtifact(params);
              break;
            }
            default:
              break;
          }
        });
      });
    };

    processSlides(referenceSlides, 'reference');
    if (templateSlides.length) processSlides(templateSlides, 'template');

    return Array.from(definitionMap.values());
  }

  /**
   * Extract student submission artifacts as primitives.
   * Returns array of { taskId, pageId, content, metadata }
   */
  extractSubmissionArtifacts(documentId, taskDefs) {
    const presentation = SlidesApp.openById(documentId);
    const slides = presentation.getSlides();
    const artifacts = [];
    // Build lookup by (pageId) => list of definitions
    const defsByPage = {};
    taskDefs.forEach((d) => {
      if (!defsByPage[d.pageId]) defsByPage[d.pageId] = [];
      defsByPage[d.pageId].push(d);
    });
    slides.forEach((slide) => {
      const pageId = this.getPageId(slide);
      const defs = defsByPage[pageId];
      if (!defs?.length) return;
      const pageElements = slide.getPageElements();
      // Simple strategy: for each definition, attempt to extract matching content type by first artifact type
      defs.forEach((def) => {
        const primary = def.getPrimaryReference() || def.getPrimaryTemplate();
        if (!primary) return;
        const typeNeeded = primary.getType();
        let extracted = null;
        if (typeNeeded === 'IMAGE') {
          // For images we just supply metadata with sourceUrl again
          extracted = {
            taskId: def.getId(),
            pageId,
            content: null,
            metadata: { sourceUrl: this.generateSlideImageUrl(documentId, pageId) },
          };
          artifacts.push(extracted);
          return;
        }
        // Traverse page elements to find first matching element (# tag with same title)
        for (const pe of pageElements) {
          const desc = pe.getDescription();
          if (!desc) continue;
          const tag = desc.charAt(0);
          const key = desc.substring(1).trim();
          if (tag !== '#' && tag !== '~') continue;
          if (key !== def.taskTitle) continue;
          if (
            typeNeeded === 'TEXT' &&
            pe.getPageElementType() === SlidesApp.PageElementType.SHAPE
          ) {
            extracted = {
              taskId: def.getId(),
              pageId,
              content: this.extractTextFromShape(pe.asShape()),
            };
            break;
          }
          if (
            typeNeeded === 'TABLE' &&
            pe.getPageElementType() === SlidesApp.PageElementType.TABLE
          ) {
            // Provide raw 2D cell array for table submission content
            extracted = {
              taskId: def.getId(),
              pageId,
              content: this.extractTableCells(pe.asTable()),
            };
            break;
          }
        }
        if (extracted) artifacts.push(extracted);
        else {
          artifacts.push({ taskId: def.getId(), pageId, content: null });
          ABLogger.getInstance().error(
            `Failed to extract artifact for task "${def.taskTitle}" on page ${pageId}.`
          );
        }
      });
    });
    return artifacts;
  }

  /**
   * Helper function to retrieve the slide ID.
   * @param {GoogleAppsScript.Slides.Slide} slide - The slide object.
   * @return {string} - The unique ID of the slide.
   */
  // Returns the pageId (slide ID for presentations or sheet tab ID for spreadsheets)
  getPageId(slide) {
    return slide.getObjectId(); // For Slides, this is the slide ID; for Sheets, this would be the tab ID
  }

  /**
   * Extracts text from a shape element.
   * @param {GoogleAppsScript.Slides.Shape} shape - The shape element to extract text from.
   * @return {string} - The extracted text from the shape.
   */
  extractTextFromShape(shape) {
    if (!shape?.getText) {
      console.log('The provided element is not a shape or does not contain text.');
      return '';
    }

    const text = shape.getText().asString();

    // If there's an empty string often the case with template slides, return an empty string rather than null.
    if (!text) {
      return '';
    }
    return text.trim();
  }

  // Legacy convertTableToMarkdown removed; use DocumentParser.convertToMarkdownTable(tableData)

  /**
   * Extracts text from a table element and converts it to Markdown.
   * @param {GoogleAppsScript.Slides.Table} table - The table element to extract text from.
   * @return {string} - The extracted Markdown text from the table.
   */
  extractTextFromTable(table) {
    // Delegate to DocumentParser helper which accepts 2D arrays. We extract cells then convert.
    const cells = this.extractTableCells(table);
    return super.convertToMarkdownTable(cells);
  }

  /**
   * Extract raw 2D cell array from a Slides table (preferred for TABLE artifacts).
   * @param {GoogleAppsScript.Slides.Table} table
   * @return {Array<Array<string|null>>} Cell values trimmed; empty cells as '' (later normalised to null by TableTaskArtifact)
   */
  extractTableCells(table) {
    try {
      if (!table || !(table.getNumRows && table.getNumColumns)) return [];
      const rows = [];
      const numRows = table.getNumRows();
      const numCols = table.getNumColumns();
      for (let r = 0; r < numRows; r++) {
        const row = [];
        for (let c = 0; c < numCols; c++) {
          const cell = table.getCell(r, c);
          const text = cell?.getText ? cell.getText().asString().trim() : '';
          row.push(text);
        }
        rows.push(row);
      }
      return rows;
    } catch (e) {
      console.error('extractTableCells failed', e);
      return [];
    }
  }

  /**
   * Extracts text from any page element (Shape, Table, Image).
   * @param {GoogleAppsScript.Slides.PageElement} pageElement - The page element to extract text from.
   * @return {string} - The extracted text or image description.
   */
  extractTextFromPageElement(pageElement) {
    const type = pageElement.getPageElementType();

    if (type === SlidesApp.PageElementType.SHAPE) {
      return this.extractTextFromShape(pageElement.asShape());
    } else if (type === SlidesApp.PageElementType.TABLE) {
      return this.extractTextFromTable(pageElement.asTable());
    } else if (type === SlidesApp.PageElementType.IMAGE) {
      return this.extractImageDescription(pageElement.asImage());
    } else {
      console.log(`Unsupported PageElementType for notes: ${type}`);
      return '';
    }
  }

  /**
   * Extracts image description or relevant metadata from an image element.
   * @param {GoogleAppsScript.Slides.Image} image - The image element to extract data from.
   * @return {string} - The extracted description or metadata.
   */
  extractImageDescription(image) {
    // Assuming that the image has alt text or description that specifies the category
    // e.g., "Diagram of the system architecture"
    const description = image.getDescription();
    return description ? description.trim() : '';
  }
}
