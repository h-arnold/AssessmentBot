import { describe, expect, it } from 'vitest';

import { CRITERIA, SOURCE_UNREADABLE_REASONING } from './syntheticAssessmentContractSupport.js';
import {
  createClassTransportBoundary,
  createFullTransportBoundary,
} from './syntheticAssessmentValidationOwners.js';
import {
  runKnownTaskCoverageMatrix,
  runNullDocumentMatrix,
} from './syntheticAssessmentValidationMatrices.js';
import {
  runArtefactSourceMatrix,
  runImageSourceSuite,
} from './syntheticAssessmentSourceMatrices.js';
import { runDefinitionSourceMatrix } from './syntheticAssessmentDefinitionSourceMatrices.js';
import {
  runParentNullSourceMatrix,
  runPopulatedSourceMatrix,
} from './syntheticAssessmentSourceStateMatrices.js';

type OwnerSubject = {
  nullDocumentTarget(): { item: Record<string, unknown> };
};

/**
 * Asserts the class-partial projection retains the null-document item's exact
 * catalogue reasoning and cause as regression coverage for the cut-over.
 */
function assertRetainedPartialReasoning(subject: unknown): void {
  const subjectOwner = subject as OwnerSubject;
  const item = subjectOwner.nullDocumentTarget().item;
  const assessments = item.assessments as Record<
    string,
    { score?: unknown; reasoning?: unknown; error?: unknown }
  >;
  expect(Object.keys(assessments).sort()).toEqual([...CRITERIA].sort());
  for (const criterion of CRITERIA) {
    const entry = assessments[criterion];
    expect(entry.score).toBe('E');
    expect(entry.reasoning).toBe(SOURCE_UNREADABLE_REASONING);
    expect(entry.error).toStrictEqual({ stage: 'acquisition', code: 'SOURCE_UNREADABLE' });
  }
}

describe('synthetic assessment transport validation', () => {
  describe('full-transport complete document source matrix', () => {
    // The full view retains usable source bodies; raw content/hash shape and
    // IMAGE/SPREADSHEET availability are pinned at the full transport owner
    // with the same isolated independent projection used above.
    runArtefactSourceMatrix({
      describe: 'Full-transport full-artefact boundary',
      subject: createFullTransportBoundary,
    });
  });

  describe('full-transport completed-image source matrix', () => {
    runImageSourceSuite({
      describe: 'Full-transport completed-IMAGE boundary',
      subject: createFullTransportBoundary,
    });
  });

  describe('full-transport null-document contradiction matrix', () => {
    // The full owner is driven directly through its assignmentsByKey
    // validator with an independent projection clone, so the class-partial
    // traversal cannot mask a full-boundary failure.
    runNullDocumentMatrix({
      describe: 'Full-transport null-document boundary',
      subject: createFullTransportBoundary,
      representation: 'full',
    });
  });

  describe('full-transport required reference/template source matrix', () => {
    runDefinitionSourceMatrix({
      describe: 'Full-transport shared-reference boundary',
      subject: createFullTransportBoundary,
    });
  });

  describe('full-transport null-document populated-source matrix', () => {
    runPopulatedSourceMatrix({
      describe: 'Full-transport populated-source boundary',
      subject: createFullTransportBoundary,
    });
  });

  describe('full-transport parent null-source matrix', () => {
    runParentNullSourceMatrix({
      describe: 'Full-transport parent null-source boundary',
      subject: createFullTransportBoundary,
    });
  });

  describe('full-transport known-task coverage boundary', () => {
    runKnownTaskCoverageMatrix({
      describe: 'Full-transport known-task coverage boundary',
      subject: createFullTransportBoundary,
    });
  });

  describe('class-transport null-document contradiction matrix over a keyed definition', () => {
    runNullDocumentMatrix({
      describe: 'Class-transport keyed-definition null-document boundary',
      subject: () => createClassTransportBoundary('keyed'),
      representation: 'partial',
      assertBaseline: assertRetainedPartialReasoning,
    });
  });

  describe('class-transport known-task coverage boundary over a keyed definition', () => {
    runKnownTaskCoverageMatrix({
      describe: 'Class-transport keyed-definition known-task coverage boundary',
      subject: () => createClassTransportBoundary('keyed'),
    });
  });

  describe('class-transport null-document contradiction matrix over a partial-only definition', () => {
    runNullDocumentMatrix({
      describe: 'Class-transport partial-only null-document boundary',
      subject: () => createClassTransportBoundary('partialOnly'),
      representation: 'partial',
      assertBaseline: assertRetainedPartialReasoning,
    });
  });

  describe('class-transport known-task coverage boundary over a partial-only definition', () => {
    runKnownTaskCoverageMatrix({
      describe: 'Class-transport partial-only known-task coverage boundary',
      subject: () => createClassTransportBoundary('partialOnly'),
    });
  });

  it('keeps class-partial content redaction valid without implying full availability', () => {
    const subject = createClassTransportBoundary('keyed');
    const target = subject.healthyDocumentTarget();
    const artefact = target.item.artifact as Record<string, unknown>;
    expect(artefact.content).toBeNull();
    expect(artefact.contentHash).toBeNull();
    expect(target.submission.documentId).not.toBeNull();
    expect(subject.validate).not.toThrow();
  });

  it('keeps partial null-document source identifiers consistent without full availability', () => {
    const subject = createClassTransportBoundary('partialOnly');
    const target = subject.nullDocumentTarget();
    const artefact = target.item.artifact as Record<string, unknown>;
    expect(target.submission.documentId).toBeNull();
    expect(artefact.pageId).toBeNull();
    expect(artefact.documentId).toBeNull();
    expect(artefact.content).toBeNull();
    expect(artefact.contentHash).toBeNull();
    expect(subject.validate).not.toThrow();
  });

  it.each(['documentId', 'pageId'] as const)(
    'rejects a partial null-document artefact with a populated %s',
    (field) => {
      const subject = createClassTransportBoundary('keyed');
      const target = subject.nullDocumentTarget();
      expect(subject.validate).not.toThrow();
      const artefact = target.item.artifact as Record<string, unknown>;
      artefact[field] = `unexpected-${field}`;
      expect(subject.validate).toThrow(/null-document/u);
    }
  );
});
