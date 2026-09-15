/**
 * SlidesParserSubmissionMatcher
 *
 * Submission-matching support for SlidesParser. Owns the student-deck index,
 * tag-preferred candidate scanning, and canonical submission payload shapes.
 * Content reads and tag helpers stay on the SlidesParser facade, which is
 * injected so spies on parser instances keep working.
 */
/* global Validate, ABLogger */

/**
 * Candidate element within a student deck. The source slide is retained so the
 * page ID is only resolved for entries that actually match.
 * @typedef {Object} SlidesSubmissionEntry
 * @property {GoogleAppsScript.Slides.Slide} slide - Source slide.
 * @property {GoogleAppsScript.Slides.PageElement} pageElement - Candidate element.
 * @property {{rawText: string, tag: string|null, tagText: string}} descriptionInfo - Parsed description.
 */

/**
 *
 */
class SlidesParserSubmissionMatcher {
  /**
   * Creates the helper with its owning parser.
   * @param {Object} dependencies - Injected dependencies.
   * @param {SlidesParser} dependencies.parser - Owning parser facade.
   */
  constructor({ parser }) {
    this.parser = parser;
  }

  /**
   * Extracts student submission artefacts as canonical primitives, matched by stable ID then title.
   * Every payload shares the shape `{ taskId, pageId, content, metadata, documentId, type }`;
   * hashing stays downstream in `StudentSubmission`.
   * Internal steps route through the facade so subclass overrides and
   * facade spies remain observable (pre-decomposition dispatch contract).
   * @param {string} documentId - Student document ID.
   * @param {TaskDefinition[]} taskDefs - Definitions to match.
   * @returns {Array<{taskId: string, pageId: string|null, content: *, metadata: Object, documentId: string, type: string}>} - Submission artefacts.
   */
  extractSubmissionArtifacts(documentId, taskDefs) {
    Validate.requireParams({ documentId, taskDefs }, 'SlidesParser.extractSubmissionArtifacts');
    const presentation = SlidesApp.openById(documentId);
    const slides = presentation.getSlides();
    const artifacts = [];
    const slideContexts = this.parser.buildSubmissionSlideContexts(slides);
    const submissionIndex = this.parser.buildSubmissionIndex(slideContexts);
    const candidatePlans = this.parser.buildSubmissionCandidatePlans(taskDefs);

    candidatePlans.forEach(({ definition, primaryType, matchCandidates }) => {
      const extracted = this.parser.collectSubmissionArtifact(
        definition,
        submissionIndex,
        primaryType,
        documentId,
        matchCandidates
      );

      if (extracted) {
        artifacts.push(extracted);
      } else {
        // Missing content stays a canonical payload so stored submissions stay complete.
        artifacts.push({
          taskId: definition.getId(),
          pageId: null,
          content: null,
          metadata: {},
          documentId,
          type: primaryType,
        });
        ABLogger.getInstance().error(
          `No submission content for task "${definition.taskTitle}" in document ${documentId}.`,
          {
            taskTitle: definition.taskTitle,
            taskId: definition.getId(),
            documentId,
            type: primaryType,
          }
        );
      }
    });

    return artifacts;
  }

  /**
   * Builds the per-run candidate plan reused for every definition lookup.
   * @param {TaskDefinition[]} taskDefs - Definitions to match.
   * @returns {Array<{definition: TaskDefinition, primaryType: string, matchCandidates: string[]}>} - Candidate plans.
   */
  buildSubmissionCandidatePlans(taskDefs) {
    const plans = [];
    taskDefs.forEach((definition) => {
      const primary = definition.getPrimaryReference() || definition.getPrimaryTemplate();
      if (!primary) return;
      plans.push({
        definition,
        primaryType: primary.getType(),
        matchCandidates: [...new Set([definition.getId(), definition.taskTitle].filter(Boolean))],
      });
    });
    return plans;
  }

  /**
   * Builds submission contexts with parsed description metadata. Slides are
   * retained so page IDs resolve lazily only for matched entries.
   * @param {GoogleAppsScript.Slides.Slide[]} slides - Student slides.
   * @returns {Array<{slide: GoogleAppsScript.Slides.Slide, elements: SlidesSubmissionEntry[]}>} - Parsed slide contexts.
   */
  buildSubmissionSlideContexts(slides) {
    return slides.map((slide) => ({
      slide,
      elements: slide.getPageElements().map((pageElement) => ({
        slide,
        pageElement,
        descriptionInfo: this.parser.parseDescriptionTag(pageElement.getDescription()),
      })),
    }));
  }

  /**
   * Builds a candidate lookup index keyed by content identifiers, not page IDs.
   * @param {Array<{slide: GoogleAppsScript.Slides.Slide, elements: SlidesSubmissionEntry[]}>} slideContexts - Parsed slide contexts.
   * @returns {Map<string, SlidesSubmissionEntry[]>} - Candidate lookup index.
   */
  buildSubmissionIndex(slideContexts) {
    const index = new Map();

    slideContexts.forEach((slideContext) => {
      slideContext.elements.forEach(({ slide, pageElement, descriptionInfo }) => {
        if (!descriptionInfo.rawText) return;

        const candidates = [
          ...new Set([descriptionInfo.rawText, descriptionInfo.tagText].filter(Boolean)),
        ];
        candidates.forEach((candidate) => {
          const bucket = index.get(candidate) || [];
          bucket.push({
            slide,
            pageElement,
            descriptionInfo,
          });
          index.set(candidate, bucket);
        });
      });
    });

    return index;
  }

  /**
   * Collects the submission artefact for a definition; page ID is metadata only.
   * Tag-qualified (`#`) matches win over bare-title matches, and the element type
   * is probed before expensive content extraction.
   * @param {TaskDefinition} definition - Definition being matched.
   * @param {Map<string, SlidesSubmissionEntry[]>} submissionIndex - Candidate lookup index.
   * @param {string} typeNeeded - Expected artefact type.
   * @param {string} documentId - Student document ID.
   * @param {string[]} matchCandidates - Candidate tokens in priority order.
   * @returns {{taskId: string, pageId: string|null, content: *, metadata: Object, documentId: string, type: string}|null} - Artefact payload or null.
   */
  collectSubmissionArtifact(definition, submissionIndex, typeNeeded, documentId, matchCandidates) {
    Validate.requireParams(
      { definition, submissionIndex, typeNeeded, documentId, matchCandidates },
      'SlidesParser.collectSubmissionArtifact'
    );
    const candidates = matchCandidates;

    if (typeNeeded === 'IMAGE') {
      return this.parser.collectTaggedImageSubmissionArtifact(
        definition,
        submissionIndex,
        candidates,
        documentId
      );
    }

    // Prefer tag-qualified matches before falling back to bare-title matches.
    const tagPreference = [true, false];
    for (const preferTagged of tagPreference) {
      const found = this.parser.scanSubmissionBuckets(
        candidates,
        submissionIndex,
        preferTagged,
        typeNeeded,
        documentId,
        definition
      );
      if (found) return found;
    }

    return null;
  }

  /**
   * Scans candidate buckets for the first entry matching the tag preference and type.
   * @param {string[]} candidates - Candidate tokens in priority order.
   * @param {Map<string, SlidesSubmissionEntry[]>} submissionIndex - Candidate lookup index.
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
    for (const candidate of candidates) {
      const matches = submissionIndex.get(candidate) || [];
      for (const entry of matches) {
        const isTagQualified = entry.descriptionInfo.tag === '#';
        if (isTagQualified !== preferTagged) continue;

        const elementType = entry.pageElement.getPageElementType();
        if (!this.parser.isExpectedElementType(elementType, typeNeeded)) continue;

        const matchedPageId = this.parser.getPageId(entry.slide);
        const contentDetails = this.parser.extractDefinitionContent(entry.pageElement, {
          elementType,
          documentId,
          pageId: matchedPageId,
          taskTitle: definition.taskTitle,
        });
        if (contentDetails?.artifactType !== typeNeeded) continue;

        this.parser.warnOnAmbiguousMatch(candidate, matches, matchedPageId, definition);
        return {
          taskId: definition.getId(),
          pageId: matchedPageId,
          content: contentDetails.elementContent,
          metadata: {},
          documentId,
          type: typeNeeded,
        };
      }
    }

    return null;
  }

  /**
   * Probes whether a Slides element type can satisfy the needed artefact type.
   * @param {string} elementType - Value from `getPageElementType()`.
   * @param {string} typeNeeded - Expected artefact type (`TEXT` or `TABLE`).
   * @returns {boolean} - True when extraction is worthwhile.
   */
  isExpectedElementType(elementType, typeNeeded) {
    if (typeNeeded === 'TABLE') return elementType === SlidesApp.PageElementType.TABLE;
    if (typeNeeded === 'TEXT') return elementType === SlidesApp.PageElementType.SHAPE;
    return false;
  }

  /**
   * Warns when the winning candidate bucket held multiple entries.
   * @param {string} candidate - Matched candidate token.
   * @param {SlidesSubmissionEntry[]} matches - Bucket entries for the token.
   * @param {string} matchedPageId - Resolved page ID of the winning entry.
   * @param {TaskDefinition} definition - Definition being matched.
   * @returns {void}
   */
  warnOnAmbiguousMatch(candidate, matches, matchedPageId, definition) {
    if (matches.length <= 1) return;
    ABLogger.getInstance().warn(
      `Multiple submission candidates for "${candidate}". Using page ${matchedPageId}.`,
      {
        candidate,
        matchedPageId,
        bucketSize: matches.length,
        taskId: definition.getId(),
        taskTitle: definition.taskTitle,
      }
    );
  }

  /**
   * Finds the first tagged image submission match.
   * @param {TaskDefinition} definition - Definition being matched.
   * @param {Map<string, SlidesSubmissionEntry[]>} submissionIndex - Candidate lookup index.
   * @param {string[]} matchCandidates - Candidate tokens.
   * @param {string} documentId - Student document ID.
   * @returns {{taskId: string, pageId: string|null, content: *, metadata: Object, documentId: string, type: string}|null} - Image payload or null.
   */
  collectTaggedImageSubmissionArtifact(definition, submissionIndex, matchCandidates, documentId) {
    for (const candidate of matchCandidates) {
      const matches = submissionIndex.get(candidate) || [];
      for (const entry of matches) {
        if (!this.parser.isImageTag(entry.descriptionInfo.tag)) continue;
        const matchedPageId = this.parser.getPageId(entry.slide);
        this.parser.warnOnAmbiguousMatch(candidate, matches, matchedPageId, definition);
        return this.parser.buildImageSubmissionArtifact(definition, documentId, matchedPageId);
      }
    }

    return null;
  }

  /**
   * Builds the image submission artefact payload.
   * @param {TaskDefinition} definition - Definition being matched.
   * @param {string} documentId - Student document ID.
   * @param {string} pageId - Matched slide page ID.
   * @returns {{taskId: string, pageId: string|null, content: *, metadata: Object, documentId: string, type: string}} - Image artefact payload.
   */
  buildImageSubmissionArtifact(definition, documentId, pageId) {
    return {
      taskId: definition.getId(),
      pageId,
      content: null,
      metadata: {
        sourceUrl: this.parser.generateSlideImageUrl(documentId, pageId),
      },
      documentId,
      type: 'IMAGE',
    };
  }
}

if (typeof module !== 'undefined') {
  module.exports = SlidesParserSubmissionMatcher;
}
