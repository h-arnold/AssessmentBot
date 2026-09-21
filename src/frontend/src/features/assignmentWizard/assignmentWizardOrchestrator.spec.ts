/**
 * Behaviour coverage for the shared forced-reparse request builder consumed by
 * the Assignments-page update wizard's Reparse documents action.
 *
 * The request is asserted against the real `UpsertAssignmentDefinitionRequestSchema`
 * so the builder stays pinned to the transport contract rather than a loose stub.
 */

import { describe, expect, it } from 'vitest';
import { buildReparseRequest } from './assignmentWizardOrchestrator';
import { UpsertAssignmentDefinitionRequestSchema } from '../../services/assignmentDefinition/assignmentDefinition.zod';
import type { AssignmentDefinition } from '../../services/assignmentDefinition/assignmentDefinition.zod';
import editableDefinitionsRaw from '../../../../../tests/__mocks__/data/synthetic-analysis/small/editableDefinitions.json?raw';

/**
 * Canonical small-profile `transport.editableDefinitions` view, imported as raw
 * text so this spec consumes the committed synthetic fixture instead of a
 * hand-copied literal that can silently drift from it.
 */
const CANONICAL_EDITABLE_DEFINITIONS = JSON.parse(editableDefinitionsRaw) as Record<
  string,
  AssignmentDefinition
>;

/** Canonical `definition-0-slides` record exercised as the loaded definition. */
const LOADED_DEFINITION: AssignmentDefinition =
  CANONICAL_EDITABLE_DEFINITIONS['definition-0-slides'];

describe('buildReparseRequest', () => {
  it('builds a forced reparse request from the loaded definition', () => {
    const request = buildReparseRequest(LOADED_DEFINITION);

    expect(request).toMatchObject({
      definitionKey: LOADED_DEFINITION.definitionKey,
      primaryTitle: LOADED_DEFINITION.primaryTitle,
      primaryTopicKey: LOADED_DEFINITION.primaryTopicKey,
      yearGroupKey: LOADED_DEFINITION.yearGroupKey,
      referenceDocumentId: LOADED_DEFINITION.referenceDocumentId,
      templateDocumentId: LOADED_DEFINITION.templateDocumentId,
      documentType: LOADED_DEFINITION.documentType,
      forceReparse: true,
    });
  });

  it('omits any weighting patch so the backend reconciles stored weightings', () => {
    const request = buildReparseRequest(LOADED_DEFINITION);

    // Explicit forced requests must omit weighting patches (including empty arrays).
    expect(request).not.toHaveProperty('taskWeightings');
    expect(request).not.toHaveProperty('assignmentWeighting');
  });

  it('produces a payload accepted by the upsert request schema', () => {
    const request = buildReparseRequest(LOADED_DEFINITION);

    expect(UpsertAssignmentDefinitionRequestSchema.safeParse(request).success).toBe(true);
  });
});
