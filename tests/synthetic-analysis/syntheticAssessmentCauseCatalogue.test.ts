import {
  createClassTransportBoundary,
  createPersistenceBoundary,
  createFullTransportBoundary,
} from './syntheticAssessmentValidationOwners.js';
import { runCauseCatalogueMatrix } from './syntheticAssessmentCauseCatalogueSupport.js';

/**
 * Implemented-Assessment cause-catalogue compliance suite. The exact
 * stage/code pairs come from the backend `Assessment` catalogue; the shared
 * runner accepts every catalogue pair on a healthy document item and rejects
 * wrong-pair causes with the mutated task path named in the diagnostic. The
 * null-parent acquisition/validation restriction is untouched and stays covered
 * by the separate null-document matrix.
 */

runCauseCatalogueMatrix({
  describe: 'persistence cause-catalogue boundary',
  subject: createPersistenceBoundary,
});

runCauseCatalogueMatrix({
  describe: 'full transport cause-catalogue boundary',
  subject: createFullTransportBoundary,
});

runCauseCatalogueMatrix({
  describe: 'class partial transport cause-catalogue boundary',
  subject: () => createClassTransportBoundary('keyed'),
});
