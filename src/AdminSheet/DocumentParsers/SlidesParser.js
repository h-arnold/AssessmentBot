/**
 * Number of hash characters retained for stable Slides task IDs.
 */
const SLIDES_TASK_ID_HASH_LENGTH = 12;

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

    if (Validate.isValidUrl(url)) {
      return url;
    } else {
      throw new Error(`Invalid URL produced.`);
    }
  }

  /**
   * Build TaskDefinitions from reference/template slide decks.
   * Tags:
   *   #TitleElement  (shape/table) -> creates/updates TaskDefinition
   *   ^TaskTitle     -> attaches taskNotes to the matching TaskDefinition
   *   ~ImageId       -> adds Image artifact using slide export URL
   * Page ordering establishes TaskDefinition.index.
   */
  extractTaskDefinitions(referenceDocumentId, templateDocumentId) {
    const referencePresentation = SlidesApp.openById(referenceDocumentId);
    const templatePresentation = templateDocumentId ? SlidesApp.openById(templateDocumentId) : null;
    const referenceSlides = referencePresentation.getSlides();
    const templateSlides = templatePresentation ? templatePresentation.getSlides() : [];

    // Map: key = taskTitle for title-based Slides matching while preserving pageId as metadata.
    const definitionMap = new Map();
    const orderState = { value: 0 };
    const context = {
      definitionMap,
      orderState,
      referenceDocumentId,
      templateDocumentId,
    };

    this.processSlidesForDefinitions(referenceSlides, 'reference', context);
    if (templateSlides.length) {
      this.processSlidesForDefinitions(templateSlides, 'template', context);
    }

    return Array.from(definitionMap.values());
  }

  /**
   * Process slides to populate task definitions from tagged elements.
   * @param {GoogleAppsScript.Slides.Slide[]} slides - Slides to inspect.
   * @param {string} role - Either 'reference' or 'template'.
   * @param {Object} context - Shared state for definition creation.
   * @return {void}
   */
  processSlidesForDefinitions(slides, role, context) {
    slides.forEach((slide) => {
      const pageId = this.getPageId(slide);
      const pageElements = slide.getPageElements();
      pageElements.forEach((pageElement) => {
        const description = pageElement.getDescription();
        const { tag, tagText } = this.parseDescriptionTag(description);
        if (!tag) return;
        switch (tag) {
          case '#':
            this.handleDefinitionTitleElement(pageElement, tagText, pageId, role, context);
            break;
          case '^':
            this.appendNotesToDefinitions(pageElement, tagText, context.definitionMap);
            break;
          case '~':
          case '|':
            this.handleImageArtifactElement(tagText, pageId, role, context);
            break;
          default:
            break;
        }
      });
    });
  }

  /**
   * Handle a title-tagged element to create or update a task definition.
   * @param {GoogleAppsScript.Slides.PageElement} pageElement - The tagged page element.
   * @param {string} taskTitle - Title extracted from the tag text.
   * @param {string} pageId - Slide page ID.
   * @param {string} role - Either 'reference' or 'template'.
   * @param {Object} context - Shared state for definition creation.
   * @return {void}
   */
  handleDefinitionTitleElement(pageElement, taskTitle, pageId, role, context) {
    const definition = this.ensureTaskDefinition(taskTitle, pageId, context);
    const contentDetails = this.extractDefinitionContent(pageElement);
    if (!contentDetails) return;

    const { artifactType, elementContent } = contentDetails;
    const params = {
      type: artifactType,
      pageId,
      content: elementContent,
      taskIndex: definition.index,
      documentId: role === 'reference' ? context.referenceDocumentId : context.templateDocumentId,
    };

    this.addArtifactToDefinition(definition, role, params);
  }

  /**
   * Append notes content to the definition with the matching task title.
   * @param {GoogleAppsScript.Slides.PageElement} pageElement - The notes element.
   * @param {string} taskTitle - Title extracted from the tag text.
   * @param {Map<string, TaskDefinition>} definitionMap - Map of task definitions keyed by title.
   * @return {void}
   */
  appendNotesToDefinitions(pageElement, taskTitle, definitionMap) {
    if (!taskTitle) {
      ABLogger.getInstance().warn('Slides notes tag requires a task title.');
      return;
    }

    const definition = definitionMap.get(this.buildDefinitionKey(taskTitle));
    if (!definition) {
      ABLogger.getInstance().warn(`No task definition found for notes tag "${taskTitle}".`);
      return;
    }

    const notesContent = this.extractTextFromPageElement(pageElement);
    definition.taskNotes = (definition.taskNotes ? definition.taskNotes + '\n' : '') + notesContent;
  }

  /**
   * Handle an image-tagged element to attach slide image artifacts.
   * @param {string} taskTitle - Title extracted from the tag text.
   * @param {string} pageId - Slide page ID.
   * @param {string} role - Either 'reference' or 'template'.
   * @param {Object} context - Shared state for definition creation.
   * @return {void}
   */
  handleImageArtifactElement(taskTitle, pageId, role, context) {
    const definition = this.ensureTaskDefinition(taskTitle, pageId, context);
    const url = this.generateSlideImageUrl(
      role === 'reference' ? context.referenceDocumentId : context.templateDocumentId,
      pageId
    );
    const params = {
      type: 'IMAGE',
      pageId,
      metadata: { sourceUrl: url },
      content: null,
      taskIndex: definition.index,
      documentId: role === 'reference' ? context.referenceDocumentId : context.templateDocumentId,
    };

    this.addArtifactToDefinition(definition, role, params);
  }

  /**
   * Ensure a task definition exists for the given title and page.
   * @param {string} taskTitle - Title extracted from the tag text.
   * @param {string} pageId - Slide page ID.
   * @param {Object} context - Shared state for definition creation.
   * @return {TaskDefinition} - Existing or newly created task definition.
   */
  ensureTaskDefinition(taskTitle, pageId, context) {
    const definitionKey = this.buildDefinitionKey(taskTitle);
    const { definitionMap, orderState } = context;
    let definition = definitionMap.get(definitionKey);
    if (!definition) {
      definition = new TaskDefinition({
        taskTitle,
        pageId,
        id: this.buildSlidesTaskId(taskTitle),
      });
      definition.index = orderState.value++;
      definitionMap.set(definitionKey, definition);
    }
    return definition;
  }

  /**
   * Build the title-based key used for Slides task matching.
   * @param {string} taskTitle - Title extracted from the slide tag.
   * @return {string} Deterministic key for Slides definitions.
   */
  buildDefinitionKey(taskTitle) {
    return taskTitle;
  }

  /**
   * Build a stable Slides task ID from task title only.
   * @param {string} taskTitle - Title extracted from the slide tag.
   * @return {string} Stable task ID for Slides definitions.
   */
  buildSlidesTaskId(taskTitle) {
    return 't_' + Utils.generateHash(taskTitle || '').substring(0, SLIDES_TASK_ID_HASH_LENGTH);
  }

  /**
   * Parse a page element description into an optional tag and identifier text.
   * @param {string} description - Raw page element description.
   * @return {{rawText: string, tag: string|null, tagText: string}} Parsed description metadata.
   */
  parseDescriptionTag(description) {
    const rawText = description ? description.trim() : '';
    if (!rawText) {
      return {
        rawText: '',
        tag: null,
        tagText: '',
      };
    }

    const tag = rawText.charAt(0);
    if (tag === '#' || tag === '^' || tag === '~' || tag === '|') {
      return {
        rawText,
        tag,
        tagText: rawText.substring(1).trim(),
      };
    }

    return {
      rawText,
      tag: null,
      tagText: rawText,
    };
  }

  /**
   * Return true when a page element description identifies the passed definition.
   * Student copies can preserve either tagged titles or plain text identifiers.
   * @param {{rawText: string, tag: string|null, tagText: string}} descriptionInfo - Parsed description metadata.
   * @param {TaskDefinition} definition - Definition being matched.
   * @return {boolean} True when the description references the task.
   */
  descriptionMatchesDefinition(descriptionInfo, definition) {
    const candidateTexts = [descriptionInfo.rawText, descriptionInfo.tagText].filter(Boolean);
    return candidateTexts.some(
      (candidate) => candidate === definition.taskTitle || candidate === definition.getId()
    );
  }

  /**
   * Extract content and Artifact type for a definition element.
   * @param {GoogleAppsScript.Slides.PageElement} pageElement - The tagged element.
   * @return {{artifactType: string, elementContent: *}|null} - Content details or null when unsupported.
   */
  extractDefinitionContent(pageElement) {
    const elementType = pageElement.getPageElementType();
    if (elementType === SlidesApp.PageElementType.SHAPE) {
      return {
        artifactType: 'TEXT',
        elementContent: this.extractTextFromShape(pageElement.asShape()),
      };
    }
    if (elementType === SlidesApp.PageElementType.TABLE) {
      return {
        artifactType: 'TABLE',
        elementContent: this.extractTableCells(pageElement.asTable()),
      };
    }
    return null;
  }

  /**
   * Attach Artifact parameters to a definition with role awareness.
   * @param {TaskDefinition} definition - Task definition to update.
   * @param {string} role - Either 'reference' or 'template'.
   * @param {Object} params - Artifact payload.
   * @return {void}
   */
  addArtifactToDefinition(definition, role, params) {
    if (role === 'reference') {
      definition.addReferenceArtifact(params);
    } else if (role === 'template') {
      definition.addTemplateArtifact(params);
    }
  }

  /**
   * Extract student submission artifacts as primitives.
   * Returns array of { taskId, pageId, content, metadata }
   */
  extractSubmissionArtifacts(documentId, taskDefs) {
    const presentation = SlidesApp.openById(documentId);
    const slides = presentation.getSlides();
    const artifacts = [];
    const slideContexts = slides.map((slide) => ({
      pageId: this.getPageId(slide),
      pageElements: slide.getPageElements(),
    }));

    taskDefs.forEach((def) => {
      const primary = def.getPrimaryReference() || def.getPrimaryTemplate();
      if (!primary) return;

      const extracted = this.collectSubmissionArtifact(
        def,
        slideContexts,
        primary.getType(),
        documentId
      );

      if (extracted) {
        artifacts.push(extracted);
      } else {
        artifacts.push({ taskId: def.getId(), pageId: null, content: null, documentId });
        ABLogger.getInstance().error(
          `Failed to extract artifact for task "${def.taskTitle}" in document ${documentId}.`
        );
      }
    });

    return artifacts;
  }

  /**
   * Collect the submission artifact content for a definition from slide elements.
   * @param {TaskDefinition} definition - Definition being matched.
   * @param {Array<{pageId: string, pageElements: GoogleAppsScript.Slides.PageElement[]}>} slideContexts - Slides and elements to search.
   * @param {string} typeNeeded - Artifact type expected (TEXT/TABLE/IMAGE).
   * @param {string} documentId - Student document ID for submission artifact.
   * @return {{taskId: string, pageId: string, content: *, metadata?: Object, documentId: string}|null} - Artifact payload or null.
   */
  collectSubmissionArtifact(definition, slideContexts, typeNeeded, documentId) {
    for (const slideContext of slideContexts) {
      for (const pageElement of slideContext.pageElements) {
        const desc = pageElement.getDescription();
        const descriptionInfo = this.parseDescriptionTag(desc);
        if (!descriptionInfo.rawText) continue;
        if (!this.descriptionMatchesDefinition(descriptionInfo, definition)) continue;

        if (typeNeeded === 'IMAGE') {
          if (descriptionInfo.tag && descriptionInfo.tag !== '~' && descriptionInfo.tag !== '|') {
            continue;
          }
          return {
            taskId: definition.getId(),
            pageId: slideContext.pageId,
            documentId,
            content: null,
            metadata: {
              sourceUrl: this.generateSlideImageUrl(documentId, slideContext.pageId),
            },
          };
        }

        if (descriptionInfo.tag && descriptionInfo.tag !== '#') continue;
        const contentDetails = this.extractDefinitionContent(pageElement);
        if (!contentDetails || contentDetails.artifactType !== typeNeeded) continue;
        return {
          taskId: definition.getId(),
          pageId: slideContext.pageId,
          documentId,
          content: contentDetails.elementContent,
        };
      }
    }
    return null;
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
      ABLogger.getInstance().warn('The provided element is not a shape or does not contain text.');
      return '';
    }

    const text = shape.getText().asString();

    // If there's an empty string often the case with template slides, return an empty string rather than null.
    if (!text) {
      return '';
    }
    return text.trim();
  }

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
          const text = this.extractCellText(cell);
          row.push(text);
        }
        rows.push(row);
      }
      return rows;
    } catch (e) {
      ABLogger.getInstance().error('extractTableCells failed', e);
      return [];
    }
  }

  /**
   * Extract text from a table cell, handling merged cells correctly.
   * @param {GoogleAppsScript.Slides.TableCell} cell - The cell to extract text from.
   * @return {string} - Trimmed text content, or empty string for merged non-head cells.
   */
  extractCellText(cell) {
    if (!cell) {
      return '';
    }
    const mergeState = cell.getMergeState();
    if (mergeState === SlidesApp.CellMergeState.MERGED) {
      ABLogger.getInstance().debug('Merged cell skipped', {
        message: 'Non-head merged cell returned as empty string',
        mergeState: 'MERGED',
      });
      return '';
    }
    const text = cell.getText().asString();
    return text.trim() || '';
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
      ABLogger.getInstance().warn(`Unsupported PageElementType for notes: ${type}`);
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

if (typeof module !== 'undefined') {
  module.exports = { SlidesParser };
}
