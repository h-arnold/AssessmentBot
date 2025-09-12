/**
 * SlidesParser Class
 * 
 * Handles extraction and processing of content from Google Slides presentations.
 * Generates slide export URLs.
 * Handles per-document rate limiting.
 */
class SlidesParser extends DocumentParser {
  /**
   * Constructs a SlidesParser instance.
   */
  constructor() {
    super(); // Call parent constructor
    // No need for requestManager since we're not fetching images here
  }

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
      throw new Error(`Invalid URL produced.`)
    }
  }

  // LEGACY extractTasks removed in refactor – replaced by extractTaskDefinitions.

  /**
   * Extracts Task instances from a Google Slides presentation.
   * Differentiates between task titles, images, notes, and entire slide images based on slide element descriptions.
   * @param {string} documentId - The ID of the Google Slides presentation.
   * @param {string|null} contentType - Type of content to extract: "reference", "template", or null for default.
   * @return {Task[]} - An array of Task instances extracted from the slides.
   * @deprecated Use extractTasks() instead
   */
  extractTasksFromSlides(documentId, contentType = null) { // Default to null
    this.extractTasks(documentId, contentType);
  }


  // ---- Phase 2 API ----
  /**
   * Build TaskDefinitions from reference/template slide decks.
   * Tags:
   *   #TitleElement  (shape/table) -> creates/updates TaskDefinition
   *   ^NotesElement  -> attaches taskNotes
   *   ~ImageId       -> adds Image artifact using slide export URL
   * Page ordering establishes TaskDefinition.index.
   */
  extractTaskDefinitions(referenceDocumentId, templateDocumentId) {
    const refPresentation = SlidesApp.openById(referenceDocumentId);
    const tplPresentation = templateDocumentId ? SlidesApp.openById(templateDocumentId) : null;
    const refSlides = refPresentation.getSlides();
    const templateSlides = tplPresentation ? tplPresentation.getSlides() : [];

    // Map: key = title + '|' + pageId (slide id) for stability
    const defMap = new Map();
    let order = 0;

    const processSlides = (slides, role) => {
      slides.forEach(slide => {
        const pageId = this.getPageId(slide);
        const pageElements = slide.getPageElements();
        pageElements.forEach(pe => {
          const description = pe.getDescription();
          if (!description || !description.length) return;
          const tag = description.charAt(0);
            const key = description.substring(1).trim();
          switch (tag) {
            case '#': { // title element -> create/find TaskDefinition
              const taskTitle = key;
              const defKey = taskTitle + '|' + pageId;
              let def = defMap.get(defKey);
              if (!def) {
                def = new TaskDefinition({ taskTitle, pageId });
                def.index = order++;
                defMap.set(defKey, def);
              }
              // Extract content (text/table) as primitive
              let content = '';
              const type = pe.getPageElementType();
              let artifactType = 'text';
              if (type === SlidesApp.PageElementType.SHAPE) {
                content = this.extractTextFromShape(pe.asShape());
                artifactType = 'text';
              } else if (type === SlidesApp.PageElementType.TABLE) {
                content = this.extractTextFromTable(pe.asTable());
                artifactType = 'table';
              } else {
                return;
              }
              if (role === 'reference') {
                def.addReferenceArtifact({ type: artifactType, pageId, content, taskIndex: def.index });
              } else if (role === 'template') {
                def.addTemplateArtifact({ type: artifactType, pageId, content, taskIndex: def.index });
              }
              break; }
            case '^': { // notes
              // Attach to existing def matching same page by last created def with pageId
              // Simpler: find any def with pageId (rare multiple) and append notes
              for (const d of defMap.values()) {
                if (d.pageId === pageId) {
                  const notesContent = this.extractTextFromPageElement(pe);
                  d.taskNotes = (d.taskNotes ? d.taskNotes + '\n' : '') + notesContent;
                }
              }
              break; }
            case '~': { // image artifact for whole slide
              const taskTitle = key; // image title key
              const defKey = taskTitle + '|' + pageId;
              let def = defMap.get(defKey);
              if (!def) {
                def = new TaskDefinition({ taskTitle, pageId });
                def.index = order++;
                defMap.set(defKey, def);
              }
              const url = this.generateSlideImageUrl(role === 'reference' ? referenceDocumentId : templateDocumentId, pageId);
              const params = { type: 'image', pageId, metadata: { sourceUrl: url }, content: null, taskIndex: def.index };
              if (role === 'reference') def.addReferenceArtifact(params); else def.addTemplateArtifact(params);
              break; }
            default:
              break;
          }
        });
      });
    };

    processSlides(refSlides, 'reference');
    if (templateSlides.length) processSlides(templateSlides, 'template');

    return Array.from(defMap.values());
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
    taskDefs.forEach(d => { if (!defsByPage[d.pageId]) defsByPage[d.pageId] = []; defsByPage[d.pageId].push(d); });
    slides.forEach(slide => {
      const pageId = this.getPageId(slide);
      const defs = defsByPage[pageId];
      if (!defs || !defs.length) return;
      const pageElements = slide.getPageElements();
      // Simple strategy: for each definition, attempt to extract matching content type by first artifact type
      defs.forEach(def => {
        const primary = def.getPrimaryReference() || def.getPrimaryTemplate();
        if (!primary) return;
        const typeNeeded = primary.getType();
        let extracted = null;
  if (typeNeeded === 'IMAGE') { // legacy lowercase no longer required
          // For images we just supply metadata with sourceUrl again
          extracted = { taskId: def.getId(), pageId, content: null, metadata: { sourceUrl: this.generateSlideImageUrl(documentId, pageId) } };
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
          if (typeNeeded === 'TEXT' && pe.getPageElementType() === SlidesApp.PageElementType.SHAPE) {
            extracted = { taskId: def.getId(), pageId, content: this.extractTextFromShape(pe.asShape()) };
            break;
          }
          if (typeNeeded === 'TABLE' && pe.getPageElementType() === SlidesApp.PageElementType.TABLE) {
            extracted = { taskId: def.getId(), pageId, content: this.extractTextFromTable(pe.asTable()) };
            break;
          }
        }
        if (extracted) artifacts.push(extracted); else {
          artifacts.push({ taskId: def.getId(), pageId, content: null });
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
    if (!shape || !shape.getText) {
      console.log("The provided element is not a shape or does not contain text.");
      return '';
    }

    const text = shape.getText().asString();
    return text.trim();
  }

  /**
   * Converts a Google Slides Table to a Markdown-formatted string.
   * @param {GoogleAppsScript.Slides.Table} table - The table element to convert.
   * @return {string} - The Markdown-formatted table.
   * @deprecated Use the superclass convertToMarkdownTable() method instead
   */
  convertTableToMarkdown(table) {
    if (!table || !(table.getNumRows() && table.getNumColumns())) {
      console.log("The provided element is not a table or is empty.");
      return '';
    }

    const numRows = table.getNumRows();
    const numCols = table.getNumColumns();
    let markdownTable = '';

    // Extract all rows' data
    let rows = [];
    for (let i = 0; i < numRows; i++) {
      let row = [];
      for (let j = 0; j < numCols; j++) {
        const cell = table.getCell(i, j);
        const text = cell.getText().asString().trim();
        // Escape pipe characters in Markdown
        const escapedText = text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
        row.push(escapedText);
      }
      rows.push(row);
    }

    if (rows.length === 0) return '';

    // Assume first row as header
    const header = rows[0];
    const separator = header.map(() => '---');
    const dataRows = rows.slice(1);

    // Create header row
    markdownTable += '| ' + header.join(' | ') + ' |\n';

    // Create separator row
    markdownTable += '| ' + separator.join(' | ') + ' |\n';

    // Create data rows
    dataRows.forEach(row => {
      markdownTable += '| ' + row.join(' | ') + ' |\n';
    });

    return markdownTable;
  }

  /**
   * Extracts text from a table element and converts it to Markdown.
   * @param {GoogleAppsScript.Slides.Table} table - The table element to extract text from.
   * @return {string} - The extracted Markdown text from the table.
   */
  extractTextFromTable(table) {
    return this.convertTableToMarkdown(table);
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