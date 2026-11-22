import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAssignmentDefinitionControllerHooks,
  installAssignmentDefinitionControllerStub,
  loadAssignmentDefinitionPartialsModule,
  expectFunctionNotInSource,
  expectPatternInSource,
  expectPatternNotInSource,
  expectValidationFunctionInSource,
  VALID_GOOGLE_URLS,
} from '../helpers/assignmentDefinitionPartialsTestHelpers.js';
const ApiValidationError = require('#backend/Utils/ErrorTypes/ApiValidationError.js');

describe('API layer: helper functions removed from source', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('should verify toCanonicalTransportDefinition_ is not present in source file', () => {
    installAssignmentDefinitionControllerStub([]);
    expectFunctionNotInSource('toCanonicalTransportDefinition_');
  });

  it('should verify buildControllerUpsertPayload_ is not present in source file', () => {
    installAssignmentDefinitionControllerStub([]);
    expectFunctionNotInSource('buildControllerUpsertPayload_');
  });

  it('should verify toPlainPartialRow_ is not present in source file', () => {
    installAssignmentDefinitionControllerStub([]);
    expectFunctionNotInSource('toPlainPartialRow_');
  });
});

describe('API layer: call sites updated', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('should verify upsertAssignmentDefinition_ calls controller.getFullAssignmentDefinition(definition)', () => {
    installAssignmentDefinitionControllerStub([]);
    expectPatternInSource('controller.getFullAssignmentDefinition(definition)');
    expectPatternNotInSource('toCanonicalTransportDefinition_(controller, definition)');
  });

  it('should verify getAssignmentDefinition_ calls controller.getFullAssignmentDefinition(definition)', () => {
    installAssignmentDefinitionControllerStub([]);
    expectPatternInSource('controller.getFullAssignmentDefinition(definition)');
    expectPatternNotInSource('toCanonicalTransportDefinition_(controller, definition)');
  });
});

describe('API layer: transport validation unchanged', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('should throw ApiValidationError when yearGroupKey is null via upsertAssignmentDefinition_', () => {
    installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const invalidPayload = {
      primaryTitle: 'Test Assignment',
      primaryTopicKey: 'test-topic',
      referenceDocumentId: 'ref-doc-001',
      templateDocumentId: 'tpl-doc-001',
      yearGroupKey: null,
    };

    expect(() => upsertAssignmentDefinition_(invalidPayload)).toThrow(ApiValidationError);
  });

  it('should throw ApiValidationError when yearGroupKey is missing via upsertAssignmentDefinition_', () => {
    installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const invalidPayload = {
      primaryTitle: 'Test Assignment',
      primaryTopicKey: 'test-topic',
      referenceDocumentId: 'ref-doc-001',
      templateDocumentId: 'tpl-doc-001',
      // yearGroupKey is missing
    };

    expect(() => upsertAssignmentDefinition_(invalidPayload)).toThrow(ApiValidationError);
  });

  it('should validate upsert parameters via validation helper', () => {
    installAssignmentDefinitionControllerStub([]);
    expectValidationFunctionInSource('validateUpsertParameters_');
  });

  it('should validate read parameters via validation helper', () => {
    installAssignmentDefinitionControllerStub([]);
    expectValidationFunctionInSource('validateReadParameters_');
  });

  it('should validate delete parameters via validation helper', () => {
    installAssignmentDefinitionControllerStub([]);
    expectValidationFunctionInSource('validateDeleteParameters_');
  });
});

describe('API layer: no assignmentWeighting defaulting in inlined code', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('should NOT add assignmentWeighting: 1 when missing from URL-based payload', () => {
    const { AssignmentDefinitionController } = installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    // Mock the controller to capture what payload it receives
    const receivedPayloads = [];
    AssignmentDefinitionController.prototype.upsertDefinition = vi.fn((payload) => {
      receivedPayloads.push(payload);
      return { definitionKey: 'test-key' };
    });

    // Mock getFullAssignmentDefinition
    AssignmentDefinitionController.prototype.getFullAssignmentDefinition = vi.fn((d) => d);

    // Need yearGroupKey for validation
    const payloadWithoutWeighting = {
      primaryTitle: 'Test Assignment',
      primaryTopicKey: 'test-topic',
      referenceDocumentUrl: VALID_GOOGLE_URLS.SLIDES.basic,
      templateDocumentUrl:
        'https://docs.google.com/presentation/d/2aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
      yearGroupKey: 'year-10',
      // assignmentWeighting is missing
    };

    upsertAssignmentDefinition_(payloadWithoutWeighting);

    // After Section 5: the inlined code should NOT add assignmentWeighting: 1
    // The payload passed to controller.upsertDefinition should NOT have assignmentWeighting added
    expect(receivedPayloads[0]).not.toHaveProperty('assignmentWeighting');
  });

  it('should NOT default assignmentWeighting when null in URL-based payload', () => {
    const { AssignmentDefinitionController } = installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const receivedPayloads = [];
    AssignmentDefinitionController.prototype.upsertDefinition = vi.fn((payload) => {
      receivedPayloads.push(payload);
      return { definitionKey: 'test-key' };
    });

    AssignmentDefinitionController.prototype.getFullAssignmentDefinition = vi.fn((d) => d);

    const payloadWithNullWeighting = {
      primaryTitle: 'Test Assignment',
      primaryTopicKey: 'test-topic',
      referenceDocumentUrl: VALID_GOOGLE_URLS.SLIDES.basic,
      templateDocumentUrl:
        'https://docs.google.com/presentation/d/2aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
      yearGroupKey: 'year-10',
      assignmentWeighting: null,
    };

    upsertAssignmentDefinition_(payloadWithNullWeighting);

    // After Section 5: the inlined code should NOT default null assignmentWeighting to 1
    // The payload passed to controller should preserve the null value
    expect(receivedPayloads[0]).toHaveProperty('assignmentWeighting', null);
  });

  it('should preserve provided assignmentWeighting values in URL-based payload', () => {
    const { AssignmentDefinitionController } = installAssignmentDefinitionControllerStub([]);

    const { upsertAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule();

    const receivedPayloads = [];
    AssignmentDefinitionController.prototype.upsertDefinition = vi.fn((payload) => {
      receivedPayloads.push(payload);
      return { definitionKey: 'test-key' };
    });

    AssignmentDefinitionController.prototype.getFullAssignmentDefinition = vi.fn((d) => d);

    const payloadWithWeighting = {
      primaryTitle: 'Test Assignment',
      primaryTopicKey: 'test-topic',
      referenceDocumentUrl: VALID_GOOGLE_URLS.SLIDES.basic,
      templateDocumentUrl:
        'https://docs.google.com/presentation/d/2aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit',
      yearGroupKey: 'year-10',
      assignmentWeighting: 5,
    };

    upsertAssignmentDefinition_(payloadWithWeighting);

    // Provided assignmentWeighting values should be preserved
    expect(receivedPayloads[0]).toHaveProperty('assignmentWeighting', 5);
  });
});
