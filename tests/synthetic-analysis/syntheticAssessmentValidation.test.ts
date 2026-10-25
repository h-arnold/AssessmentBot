import { describe, expect, it } from 'vitest';

import {
  createFullTransportBoundary,
  createPersistenceBoundary,
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

describe('synthetic assessment persistence validation', () => {
  describe('persistence null-document contradiction matrix', () => {
    runNullDocumentMatrix({
      describe: 'Persistence graph null-document boundary',
      subject: createPersistenceBoundary,
      representation: 'full',
    });
  });

  describe('persistence known-task coverage boundary', () => {
    runKnownTaskCoverageMatrix({
      describe: 'Persistence graph known-task coverage boundary',
      subject: createPersistenceBoundary,
    });
  });

  describe('persistence full-artefact source matrix', () => {
    runArtefactSourceMatrix({
      describe: 'Persistence full-artefact boundary',
      subject: createPersistenceBoundary,
    });
  });

  describe('persistence completed-image source matrix', () => {
    runImageSourceSuite({
      describe: 'Persistence completed-IMAGE boundary',
      subject: createPersistenceBoundary,
    });
  });

  describe('persistence required reference/template source matrix', () => {
    runDefinitionSourceMatrix({
      describe: 'Persistence shared-reference boundary',
      subject: createPersistenceBoundary,
    });
  });

  describe('persistence null-document populated-source boundary', () => {
    runPopulatedSourceMatrix({
      describe: 'Persistence populated-source boundary',
      subject: createPersistenceBoundary,
    });
  });

  describe('persistence parent null-source boundary', () => {
    runParentNullSourceMatrix({
      describe: 'Persistence parent null-source boundary',
      subject: createPersistenceBoundary,
    });
  });

  it('validates the canonical boundary graph across the persistence and full-transport owners', () => {
    // Narrow aggregate smoke: the canonicalised graph itself is a valid input
    // for both owners; per-rule proof stays with the dedicated matrices.
    expect(createPersistenceBoundary().validate).not.toThrow();
    expect(createFullTransportBoundary().validate).not.toThrow();
  });
});
