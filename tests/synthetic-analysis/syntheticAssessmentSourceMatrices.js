import { describe, expect, it } from 'vitest';

import {
  assessmentCauseEntries,
  CONTENT_RULE,
  expectRule,
  HASH_RULE,
  IMAGE_RULE,
  SPREADSHEET_RULE,
} from './syntheticAssessmentValidationRules.js';
import {
  assertDecodablePngDataUrl,
  buildSyntheticPngDataUrl,
} from './syntheticAssessmentImageBodySupport.js';

/**
 * Full-source artefact boundary matrices for the synthetic assessment
 * validator suites: completed TEXT/IMAGE/SPREADSHEET body shapes, content and
 * hash availability, and the permitted null-body acquisition placeholders.
 *
 * @remarks
 * Partial redaction is the exempt case: null content/hash there is deliberate,
 * never rejected (see the transport suite). Rows mutate one cloned boundary
 * record only; the valid IMAGE baseline is asserted before each corruption.
 */

/** Usable completed IMAGE data-URL body: a small deterministic, structurally valid PNG. */
export const USABLE_IMAGE_DATA_URL = buildSyntheticPngDataUrl(1, 1);
/** Usable completed SPREADSHEET grid in its raw 2D-array representation. */
export const USABLE_SPREADSHEET_GRID = [
  ['=SUM(A1)', 'ready'],
  ['=B1+C1', null],
];

/**
 * Switches a healthy document item to a completed IMAGE artefact.
 *
 * @param {{item: Record<string, unknown>, submission: Record<string, unknown>}} target Owner target.
 * @returns {{item: Record<string, unknown>, submission: Record<string, unknown>}} Same target.
 */
export function applyCompletedImageArtefact(target) {
  const artefact = /** @type {Record<string, unknown>} */ (structuredClone(target.item.artifact));
  artefact.type = 'IMAGE';
  artefact.role = 'submission';
  artefact.pageId = 'image-page';
  artefact.documentId = target.submission.documentId ?? null;
  artefact.content = USABLE_IMAGE_DATA_URL;
  artefact.contentHash = 'hash-completed-image-body';
  target.item.artifact = artefact;
  return target;
}

/**
 * Switches a healthy document item to a completed SPREADSHEET artefact.
 *
 * @param {{item: Record<string, unknown>, submission: Record<string, unknown>}} target Owner target.
 * @returns {{item: Record<string, unknown>, submission: Record<string, unknown>}} Same target.
 */
export function applyCompletedSpreadsheetArtefact(target) {
  const artefact = /** @type {Record<string, unknown>} */ (structuredClone(target.item.artifact));
  artefact.type = 'SPREADSHEET';
  artefact.role = 'submission';
  artefact.pageId = 'spreadsheet-page';
  artefact.documentId = target.submission.documentId ?? null;
  artefact.content = structuredClone(USABLE_SPREADSHEET_GRID);
  artefact.contentHash = 'hash-completed-spreadsheet-body';
  target.item.artifact = artefact;
  return target;
}

/**
 * Rejection rows for full artefact content/hash raw-shape probes.
 *
 * @type {ReadonlyArray<[string, (target: {item: Record<string, unknown>, submission: Record<string, unknown>}) => void, string]>}
 */
export const ARTEFACT_REJECTION_ROWS = [
  [
    'null content beside complete numeric results',
    (target) => {
      target.item.artifact.content = null;
    },
    CONTENT_RULE,
  ],
  [
    'a missing content key',
    (target) => {
      delete target.item.artifact.content;
    },
    CONTENT_RULE,
  ],
  [
    'a missing contentHash key',
    (target) => {
      delete target.item.artifact.contentHash;
    },
    HASH_RULE,
  ],
  [
    'null contentHash beside present content',
    (target) => {
      target.item.artifact.contentHash = null;
    },
    HASH_RULE,
  ],
  [
    'an array TEXT body',
    (target) => {
      target.item.artifact.content = ['not-a-text-body'];
    },
    CONTENT_RULE,
  ],
  [
    'an encoded SPREADSHEET body',
    (target) => {
      target.item.artifact.content = JSON.stringify([[['=SUM(A1)']]]);
      target.item.artifact.type = 'SPREADSHEET';
    },
    SPREADSHEET_RULE,
  ],
];

/**
 * Rejection rows for a completed IMAGE artefact after its valid baseline.
 *
 * @type {ReadonlyArray<[string, (target: {item: Record<string, unknown>, submission: Record<string, unknown>}) => void, string]>}
 */
export const IMAGE_REJECTION_ROWS = [
  [
    'a null image body',
    (target) => {
      target.item.artifact.content = null;
    },
    CONTENT_RULE,
  ],
  [
    'a body that is not an image data URL',
    (target) => {
      target.item.artifact.content = 'not-an-image-body';
    },
    IMAGE_RULE,
  ],
  [
    'a missing image hash',
    (target) => {
      target.item.artifact.contentHash = null;
    },
    HASH_RULE,
  ],
];

/**
 * Runs the full-artefact source matrix for one owning validator.
 *
 * @param {{
 *   describe: string,
 *   subject: () => {validate: () => void, healthyDocumentTarget: () => {item: Record<string, unknown>, submission: Record<string, unknown>}},
 * }} config Suite configuration.
 */
export function runArtefactSourceMatrix(config) {
  describe(config.describe, () => {
    it('accepts the validated completed document artefacts', () => {
      const subject = config.subject();
      expect(subject.healthyDocumentTarget().submission.documentId).not.toBeNull();
      expect(subject.validate).not.toThrow();
    });

    it('accepts a usable completed SPREADSHEET artefact in its raw array representation', () => {
      const subject = config.subject();
      applyCompletedSpreadsheetArtefact(subject.healthyDocumentTarget());
      expect(subject.validate).not.toThrow();
    });

    it.each(ARTEFACT_REJECTION_ROWS)('rejects %s', (_label, mutate, rule) => {
      const subject = config.subject();
      mutate(subject.healthyDocumentTarget());
      expectRule(subject.validate, rule, []);
    });
  });
}

/**
 * Runs the completed-IMAGE source suite for one owning validator.
 *
 * @param {{
 *   describe: string,
 *   subject: () => {validate: () => void, nullDocumentTarget: () => {item: Record<string, unknown>, submission: Record<string, unknown>}, healthyDocumentTarget: () => {item: Record<string, unknown>, submission: Record<string, unknown>}},
 *   assertHealthyArtefact?: (target: unknown) => void,
 * }} config Suite configuration.
 */
export function runImageSourceSuite(config) {
  describe(config.describe, () => {
    it('accepts a healthy completed IMAGE artefact with a usable data URL body, hash and source identities', () => {
      const subject = config.subject();
      const target = applyCompletedImageArtefact(subject.healthyDocumentTarget());
      const artefact = /** @type {Record<string, unknown>} */ (target.item.artifact);
      expect(artefact.content).toMatch(/^data:image\//u);
      assertDecodablePngDataUrl(
        /** @type {string} */ (artefact.content),
        'completed IMAGE control body'
      );
      expect(artefact.contentHash).not.toBeNull();
      expect(artefact.documentId).not.toBeNull();
      config.assertHealthyArtefact?.(target);
      expect(subject.validate).not.toThrow();
    });

    it('accepts the permitted null-body extraction placeholder for a document-bearing IMAGE artefact', () => {
      const subject = config.subject();
      const target = applyCompletedImageArtefact(subject.healthyDocumentTarget());
      const artefact = /** @type {Record<string, unknown>} */ (target.item.artifact);
      // The explicit null placeholder pair keeps the document-bearing IMAGE
      // artefact with null content beside its null contentHash and placeholder
      // extraction entries; source identities stay intact.
      artefact.content = null;
      artefact.contentHash = null;
      expect(artefact.type).toBe('IMAGE');
      expect(artefact.documentId).not.toBeNull();
      expect(artefact.content).toBeNull();
      expect(artefact.contentHash).toBeNull();
      target.item.assessments = assessmentCauseEntries('extraction', 'SOURCE_CONTENT_UNAVAILABLE');
      expect(subject.validate).not.toThrow();
    });

    it.each(IMAGE_REJECTION_ROWS)(
      'rejects a completed IMAGE artefact with %s',
      (_label, mutate, rule) => {
        const subject = config.subject();
        mutate(applyCompletedImageArtefact(subject.healthyDocumentTarget()));
        expectRule(subject.validate, rule, []);
      }
    );
  });
}
