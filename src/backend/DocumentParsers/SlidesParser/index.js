/** Stable Slides task ID hash length. */
const SLIDES_TASK_ID_HASH_LENGTH = 12;

/** Image tags (`~` and `|`) attach a slide image artefact. @type {Set<string>} */
const IMAGE_TAGS = new Set(['~', '|']);

/** SlidesParser extracts content from Slides decks and generates slide export URLs. */
/* global SlidesParserTableContent, SlidesParserSubmissionMatcher */
/**
 *
 */
class SlidesParser extends DocumentParser {
  /**
   * Creates the parser with submission and table helpers injected.
   */
  constructor() {
    super();
    this._tableContent = new SlidesParserTableContent({ parser: this });
    this._submissionMatcher = new SlidesParserSubmissionMatcher({ parser: this });
  }

  /**
   * Generates a slide export URL.
   * @param {string} documentId - Presentation ID.
   * @param {string} pageId - Slide ID.
   * @returns {string} - Slide export URL.
   */
  generateSlideImageUrl(documentId, pageId) {
    Validate.requireParams({ documentId, pageId }, 'SlidesParser.generateSlideImageUrl');
    if (!Validate.isNonEmptyString(documentId) || !Validate.isNonEmptyString(pageId)) {
      throw new Error(
        `Invalid slide image identifiers (documentId: "${documentId}", pageId: "${pageId}").`
      );
    }
    return `https://docs.google.com/presentation/d/${documentId}/export/png?id=${documentId}&pageid=${pageId}`;
  }

  /**
   * Builds TaskDefinitions from reference/template decks (`#` defines, `~`/`|` adds IMAGE).
   * @param {string} referenceDocumentId - Reference presentation ID.
   * @param {string|null} templateDocumentId - Template presentation ID or null.
   * @returns {TaskDefinition[]} - Ordered task definitions.
   */
  extractTaskDefinitions(referenceDocumentId, templateDocumentId) {
    Validate.requireParams({ referenceDocumentId }, 'SlidesParser.extractTaskDefinitions');
    const referencePresentation = SlidesApp.openById(referenceDocumentId);
    const templatePresentation = templateDocumentId ? SlidesApp.openById(templateDocumentId) : null;
    const referenceSlides = referencePresentation.getSlides();
    const templateSlides = templatePresentation ? templatePresentation.getSlides() : [];

    // Map: key = taskTitle for title-based Slides matching while preserving pageId as metadata.
    const definitionMap = new Map();
    const context = {
      definitionMap,
      nextIndex: 0,
      documentIdByRole: {
        reference: referenceDocumentId,
        template: templateDocumentId,
      },
      seenTitlesByRole: {
        reference: new Set(),
        template: new Set(),
      },
    };

    this.processSlidesForDefinitions(referenceSlides, 'reference', context);
    this.processSlidesForDefinitions(templateSlides, 'template', context);

    return [...definitionMap.values()];
  }

  /**
   * Populates task definitions from tagged elements.
   * @param {GoogleAppsScript.Slides.Slide[]} slides - Slides to inspect.
   * @param {string} role - Either 'reference' or 'template'.
   * @param {Object} context - Shared definition state.
   * @returns {void}
   */
  processSlidesForDefinitions(slides, role, context) {
    slides.forEach((slide) => {
      const pageId = this.getPageId(slide);
      const pageElements = slide.getPageElements();
      pageElements.forEach((pageElement) => {
        const description = pageElement.getDescription();
        const { tag, tagText, rawText } = this.parseDescriptionTag(description);
        if (!tag) return;
        if (!tagText) {
          const message = `Empty tag text for "${rawText}" on page ${pageId} (role: ${role}).`;
          ABLogger.getInstance().error(message, { pageId, role, rawText });
          throw new Error(message);
        }
        if (tag === '#') {
          this.handleDefinitionTitleElement(pageElement, tagText, pageId, role, context);
        } else if (this.isImageTag(tag)) {
          this.handleImageArtifactElement(tagText, pageId, role, context);
        }
      });
    });
  }

  /**
   * Creates or updates a definition from a `#` element.
   * @param {GoogleAppsScript.Slides.PageElement} pageElement - Tagged element.
   * @param {string} taskTitle - Title from the tag text.
   * @param {string} pageId - Slide page ID.
   * @param {string} role - Either 'reference' or 'template'.
   * @param {Object} context - Shared definition state.
   * @returns {void}
   */
  handleDefinitionTitleElement(pageElement, taskTitle, pageId, role, context) {
    const definition = this.ensureTaskDefinition(taskTitle, pageId, context, role, true);
    const contentDetails = this.extractDefinitionContent(pageElement, {
      documentId: context.documentIdByRole[role],
      pageId,
      taskTitle,
    });
    if (!contentDetails) {
      ABLogger.getInstance().warn(`No extractable content for title tag "${taskTitle}".`, {
        taskTitle,
        pageId,
        role,
      });
      return;
    }

    const { artifactType, elementContent } = contentDetails;
    const parameters = {
      type: artifactType,
      pageId,
      content: elementContent,
      taskIndex: definition.index,
      documentId: context.documentIdByRole[role],
    };

    definition.createArtifact(role, parameters);
  }

  /**
   * Attaches a slide image artefact from a `~`/`|` element.
   * @param {string} taskTitle - Title from the tag text.
   * @param {string} pageId - Slide page ID.
   * @param {string} role - Either 'reference' or 'template'.
   * @param {Object} context - Shared definition state.
   * @returns {void}
   */
  handleImageArtifactElement(taskTitle, pageId, role, context) {
    const definition = this.ensureTaskDefinition(taskTitle, pageId, context, role, false);
    const url = this.generateSlideImageUrl(context.documentIdByRole[role], pageId);
    const parameters = {
      type: 'IMAGE',
      pageId,
      metadata: { sourceUrl: url },
      content: null,
      taskIndex: definition.index,
      documentId: context.documentIdByRole[role],
    };

    definition.createArtifact(role, parameters);
  }

  /**
   * True for image tags (`~`, `|`).
   * @param {string|null} tag - Tag character.
   * @returns {boolean} - True for image tags.
   */
  isImageTag(tag) {
    return IMAGE_TAGS.has(tag);
  }

  /**
   * Ensures a definition exists; duplicate `#` titles within one role throw.
   * @param {string} taskTitle - Title from the tag text.
   * @param {string} pageId - Slide page ID.
   * @param {Object} context - Shared definition state.
   * @param {string} role - Either 'reference' or 'template'.
   * @param {boolean} isTitleTag - True for `#` titles.
   * @returns {TaskDefinition} - Existing or new definition.
   */
  ensureTaskDefinition(taskTitle, pageId, context, role, isTitleTag) {
    const { definitionMap, seenTitlesByRole } = context;
    const seenForRole = seenTitlesByRole[role];
    if (definitionMap.has(taskTitle)) {
      if (isTitleTag && seenForRole.has(taskTitle)) {
        const message = `Duplicate title tag "${taskTitle}" on page ${pageId} (role: ${role}).`;
        ABLogger.getInstance().error(message, { taskTitle, pageId, role });
        throw new Error(message);
      }
      if (isTitleTag) {
        seenForRole.add(taskTitle);
      }
      return definitionMap.get(taskTitle);
    }
    const definition = new TaskDefinition({
      taskTitle,
      pageId,
      id: this.buildSlidesTaskId(taskTitle),
    });
    definition.index = context.nextIndex++;
    definitionMap.set(taskTitle, definition);
    if (isTitleTag) {
      seenForRole.add(taskTitle);
    }
    return definition;
  }

  /**
   * Builds a stable Slides task ID from the title only.
   * @param {string} taskTitle - Title from the slide tag.
   * @returns {string} - Stable task ID.
   */
  buildSlidesTaskId(taskTitle) {
    return 't_' + Utils.generateHash(taskTitle).slice(0, Math.max(0, SLIDES_TASK_ID_HASH_LENGTH));
  }

  /**
   * Parses a description into tag metadata.
   * @param {string} description - Raw element description.
   * @returns {{rawText: string, tag: string|null, tagText: string}} - Parsed metadata.
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
    if (tag === '#' || this.isImageTag(tag)) {
      return {
        rawText,
        tag,
        tagText: rawText.slice(1).trim(),
      };
    }

    return {
      rawText,
      tag: null,
      tagText: '',
    };
  }

  /**
   * Extracts content details or null when the element type is unsupported.
   * Delegates to the table-content helper.
   * @param {GoogleAppsScript.Slides.PageElement} pageElement - Tagged element.
   * @param {Object} context - Extraction context (documentId, pageId, taskTitle, elementType).
   * @returns {{artifactType: string, elementContent: *}|null} - Details or null.
   */
  extractDefinitionContent(pageElement, context) {
    return this._tableContent.extractDefinitionContent(pageElement, context);
  }

  /**
   * Extracts student submission artefacts as canonical primitives.
   * Delegates to the submission-matching helper.
   * @param {string} documentId - Student document ID.
   * @param {TaskDefinition[]} taskDefs - Definitions to match.
   * @returns {Array<{taskId: string, pageId: string|null, content: *, metadata: Object, documentId: string, type: string}>} - Submission artefacts.
   */
  extractSubmissionArtifacts(documentId, taskDefs) {
    return this._submissionMatcher.extractSubmissionArtifacts(documentId, taskDefs);
  }

  /**
   * Builds the per-run candidate plan reused for every definition lookup.
   * Delegates to the submission-matching helper.
   * @param {TaskDefinition[]} taskDefs - Definitions to match.
   * @returns {Array<{definition: TaskDefinition, primaryType: string, matchCandidates: string[]}>} - Candidate plans.
   */
  buildSubmissionCandidatePlans(taskDefs) {
    return this._submissionMatcher.buildSubmissionCandidatePlans(taskDefs);
  }

  /**
   * Builds submission contexts with parsed description metadata.
   * Delegates to the submission-matching helper.
   * @param {GoogleAppsScript.Slides.Slide[]} slides - Student slides.
   * @returns {Array} - Parsed slide contexts.
   */
  buildSubmissionSlideContexts(slides) {
    return this._submissionMatcher.buildSubmissionSlideContexts(slides);
  }

  /**
   * Builds a candidate lookup index keyed by content identifiers, not page IDs.
   * Delegates to the submission-matching helper.
   * @param {Array} slideContexts - Parsed slide contexts.
   * @returns {Map<string, Array>} - Candidate lookup index.
   */
  buildSubmissionIndex(slideContexts) {
    return this._submissionMatcher.buildSubmissionIndex(slideContexts);
  }

  /**
   * Collects the submission artefact for a definition.
   * Delegates to the submission-matching helper.
   * @param {TaskDefinition} definition - Definition being matched.
   * @param {Map<string, Array>} submissionIndex - Candidate lookup index.
   * @param {string} typeNeeded - Expected artefact type.
   * @param {string} documentId - Student document ID.
   * @param {string[]} matchCandidates - Candidate tokens in priority order.
   * @returns {{taskId: string, pageId: string|null, content: *, metadata: Object, documentId: string, type: string}|null} - Artefact payload or null.
   */
  collectSubmissionArtifact(definition, submissionIndex, typeNeeded, documentId, matchCandidates) {
    return this._submissionMatcher.collectSubmissionArtifact(
      definition,
      submissionIndex,
      typeNeeded,
      documentId,
      matchCandidates
    );
  }

  /**
   * Scans candidate buckets for the first entry matching the tag preference and type.
   * Delegates to the submission-matching helper.
   * @param {string[]} candidates - Candidate tokens in priority order.
   * @param {Map<string, Array>} submissionIndex - Candidate lookup index.
   * @param {boolean} preferTagged - True to match `#` entries, false for bare titles.
   * @param {string} typeNeeded - Expected artefact type.
   * @param {string} documentId - Student document ID.
   * @param {TaskDefinition} definition - Definition being matched.
   * @returns {{taskId: string, pageId: string|null, content: *, metadata: Object, documentId: string, type: string}|null} - Artefact payload or null.
   */
  scanSubmissionBuckets(
    candidates,
    submissionIndex,
    preferTagged,
    typeNeeded,
    documentId,
    definition
  ) {
    return this._submissionMatcher.scanSubmissionBuckets(
      candidates,
      submissionIndex,
      preferTagged,
      typeNeeded,
      documentId,
      definition
    );
  }

  /**
   * Probes whether a Slides element type can satisfy the needed artefact type.
   * Delegates to the submission-matching helper.
   * @param {string} elementType - Value from `getPageElementType()`.
   * @param {string} typeNeeded - Expected artefact type (`TEXT` or `TABLE`).
   * @returns {boolean} - True when extraction is worthwhile.
   */
  isExpectedElementType(elementType, typeNeeded) {
    return this._submissionMatcher.isExpectedElementType(elementType, typeNeeded);
  }

  /**
   * Warns when the winning candidate bucket held multiple entries.
   * Delegates to the submission-matching helper.
   * @param {string} candidate - Matched candidate token.
   * @param {Array} matches - Bucket entries for the token.
   * @param {string} matchedPageId - Resolved page ID of the winning entry.
   * @param {TaskDefinition} definition - Definition being matched.
   * @returns {void}
   */
  warnOnAmbiguousMatch(candidate, matches, matchedPageId, definition) {
    this._submissionMatcher.warnOnAmbiguousMatch(candidate, matches, matchedPageId, definition);
  }

  /**
   * Finds the first tagged image submission match.
   * Delegates to the submission-matching helper.
   * @param {TaskDefinition} definition - Definition being matched.
   * @param {Map<string, Array>} submissionIndex - Candidate lookup index.
   * @param {string[]} matchCandidates - Candidate tokens.
   * @param {string} documentId - Student document ID.
   * @returns {{taskId: string, pageId: string|null, content: *, metadata: Object, documentId: string, type: string}|null} - Image payload or null.
   */
  collectTaggedImageSubmissionArtifact(definition, submissionIndex, matchCandidates, documentId) {
    return this._submissionMatcher.collectTaggedImageSubmissionArtifact(
      definition,
      submissionIndex,
      matchCandidates,
      documentId
    );
  }

  /**
   * Builds the image submission artefact payload.
   * Delegates to the submission-matching helper.
   * @param {TaskDefinition} definition - Definition being matched.
   * @param {string} documentId - Student document ID.
   * @param {string} pageId - Matched slide page ID.
   * @returns {{taskId: string, pageId: string|null, content: *, metadata: Object, documentId: string, type: string}} - Image artefact payload.
   */
  buildImageSubmissionArtifact(definition, documentId, pageId) {
    return this._submissionMatcher.buildImageSubmissionArtifact(definition, documentId, pageId);
  }

  /**
   * Returns the slide ID. Delegates to the table-content helper.
   * @param {GoogleAppsScript.Slides.Slide} slide - Slide object.
   * @returns {string} - Slide ID.
   */
  getPageId(slide) {
    return this._tableContent.getPageId(slide);
  }

  /**
   * Extracts trimmed text from a shape. Delegates to the table-content helper.
   * @param {GoogleAppsScript.Slides.Shape} shape - Shape element.
   * @returns {string} - Trimmed text.
   */
  extractTextFromShape(shape) {
    return this._tableContent.extractTextFromShape(shape);
  }

  /**
   * Extracts raw 2D cells. Delegates to the table-content helper.
   * @param {GoogleAppsScript.Slides.Table} table - Table element.
   * @param {Object} context - Extraction context (documentId, pageId, taskTitle).
   * @returns {Array} - Trimmed cell values.
   */
  extractTableCells(table, context) {
    return this._tableContent.extractTableCells(table, context);
  }

  /**
   * Extracts trimmed cell text, or '' for merged non-head cells.
   * Delegates to the table-content helper.
   * @param {GoogleAppsScript.Slides.TableCell} cell - Cell element.
   * @param {string} mergeState - Pre-resolved merge state from the table loop.
   * @returns {string} - Trimmed text or ''.
   */
  extractCellText(cell, mergeState) {
    return this._tableContent.extractCellText(cell, mergeState);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { SlidesParser };
}
