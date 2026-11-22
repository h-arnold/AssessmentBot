import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createAssignmentDefinitionControllerHooks,
  installAssignmentDefinitionControllerStub,
  loadAssignmentDefinitionValidationModule,
} from '../helpers/assignmentDefinitionPartialsTestHelpers.js';
const ApiValidationError = require('#backend/Utils/ErrorTypes/ApiValidationError.js');

describe('throwValidationError_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('throws ApiValidationError with correct properties', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwValidationError_ } = loadAssignmentDefinitionValidationModule();

    expect(() => throwValidationError_('test message', 'testField', 5)).toThrow(ApiValidationError);
    try {
      throwValidationError_('test message', 'testField', 5);
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('getAssignmentDefinitionPartials');
      expect(err.fieldName).toBe('testField');
      expect(err.details).toBe('rowIndex=5');
    }
  });

  it('throws ApiValidationError with null fieldName', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwValidationError_ } = loadAssignmentDefinitionValidationModule();

    try {
      throwValidationError_('test message', null, 10);
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('getAssignmentDefinitionPartials');
      expect(err.fieldName).toBe(null);
      expect(err.details).toBe('rowIndex=10');
    }
  });

  it('throws ApiValidationError with zero rowIndex', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwValidationError_ } = loadAssignmentDefinitionValidationModule();

    try {
      throwValidationError_('test message', 'field', 0);
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('getAssignmentDefinitionPartials');
      expect(err.fieldName).toBe('field');
      expect(err.details).toBe('rowIndex=0');
    }
  });
});

describe('throwReadValidationError_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('throws ApiValidationError with correct properties for read operations', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwReadValidationError_ } = loadAssignmentDefinitionValidationModule();

    expect(() => throwReadValidationError_('test message', 'testField')).toThrow(
      ApiValidationError
    );
    try {
      throwReadValidationError_('test message', 'testField');
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('getAssignmentDefinition');
      expect(err.fieldName).toBe('testField');
    }
  });

  it('throws ApiValidationError with null fieldName', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwReadValidationError_ } = loadAssignmentDefinitionValidationModule();

    try {
      throwReadValidationError_('test message', null);
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('getAssignmentDefinition');
      expect(err.fieldName).toBe(null);
    }
  });
});

describe('throwUpsertValidationError_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('throws ApiValidationError with correct properties for upsert operations', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwUpsertValidationError_ } = loadAssignmentDefinitionValidationModule();

    expect(() => throwUpsertValidationError_('test message', 'testField')).toThrow(
      ApiValidationError
    );
    try {
      throwUpsertValidationError_('test message', 'testField');
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('upsertAssignmentDefinition');
      expect(err.fieldName).toBe('testField');
    }
  });

  it('throws ApiValidationError with null fieldName', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwUpsertValidationError_ } = loadAssignmentDefinitionValidationModule();

    try {
      throwUpsertValidationError_('test message', null);
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('upsertAssignmentDefinition');
      expect(err.fieldName).toBe(null);
    }
  });
});

describe('throwDeleteValidationError_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('throws ApiValidationError with correct properties for delete operations', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwDeleteValidationError_ } = loadAssignmentDefinitionValidationModule();

    expect(() => throwDeleteValidationError_('test message', 'testField')).toThrow(
      ApiValidationError
    );
    try {
      throwDeleteValidationError_('test message', 'testField');
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('deleteAssignmentDefinition');
      expect(err.fieldName).toBe('testField');
    }
  });

  it('throws ApiValidationError with null fieldName', () => {
    installAssignmentDefinitionControllerStub([]);
    const { throwDeleteValidationError_ } = loadAssignmentDefinitionValidationModule();

    try {
      throwDeleteValidationError_('test message', null);
    } catch (err) {
      expect(err.message).toBe('test message');
      expect(err.method).toBe('deleteAssignmentDefinition');
      expect(err.fieldName).toBe(null);
    }
  });
});
