import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loadApiHandlerModule,
  setupDispatcherTest,
  teardownDispatcherTest,
} = require('./shared.js');

describe('Api/apiHandler dispatcher — DefinitionStaleError transport mapping', () => {
  let context;

  beforeEach(() => {
    context = setupDispatcherTest(vi);
  });

  afterEach(() => {
    teardownDispatcherTest(vi, context);
  });

  describe('_mapErrorToFailureEnvelope with DefinitionStaleError', () => {
    it('maps DefinitionStaleError to DEFINITION_STALE error code', () => {
      const DefinitionStaleError = globalThis.DefinitionStaleError;
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const staleError = new DefinitionStaleError(
        'Definition is stale. Please refresh and retry.',
        {
          definitionKey: 'algebra-baseline',
          referenceStale: true,
          templateStale: false,
          referenceLastModified: '2025-06-01T10:00:00.000Z',
          templateLastModified: '2025-05-15T08:30:00.000Z',
        }
      );

      const result = dispatcher._mapErrorToFailureEnvelope('req-def-stale-001', staleError);

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'DEFINITION_STALE',
          message: 'Definition is stale. Please refresh and retry.',
        },
      });
    });

    it('includes details block with definitionKey, referenceStale, templateStale, referenceLastModified, templateLastModified', () => {
      const DefinitionStaleError = globalThis.DefinitionStaleError;
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const staleError = new DefinitionStaleError('Definition is stale.', {
        definitionKey: 'geometry-test',
        referenceStale: false,
        templateStale: true,
        referenceLastModified: '2025-05-01T09:00:00.000Z',
        templateLastModified: '2025-06-10T14:30:00.000Z',
      });

      const result = dispatcher._mapErrorToFailureEnvelope('req-def-stale-002', staleError);

      expect(result.error.details).toEqual({
        definitionKey: 'geometry-test',
        referenceStale: false,
        templateStale: true,
        referenceLastModified: '2025-05-01T09:00:00.000Z',
        templateLastModified: '2025-06-10T14:30:00.000Z',
      });
    });

    it('marks DefinitionStaleError as non-retriable', () => {
      const DefinitionStaleError = globalThis.DefinitionStaleError;
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const staleError = new DefinitionStaleError('Definition is stale.', {
        definitionKey: 'science-baseline',
        referenceStale: true,
        templateStale: true,
        referenceLastModified: null,
        templateLastModified: null,
      });

      const result = dispatcher._mapErrorToFailureEnvelope('req-def-stale-003', staleError);

      expect(result.error).toMatchObject({
        code: 'DEFINITION_STALE',
        retriable: false,
      });
    });

    it('maps DefinitionStaleError with empty message to DEFINITION_STALE (hasMessage guard should not block)', () => {
      const DefinitionStaleError = globalThis.DefinitionStaleError;
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const staleError = new DefinitionStaleError('', {
        definitionKey: 'physics-baseline',
        referenceStale: true,
        templateStale: false,
        referenceLastModified: '2025-07-01T10:00:00.000Z',
        templateLastModified: null,
      });

      const result = dispatcher._mapErrorToFailureEnvelope('req-empty-msg', staleError);

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'DEFINITION_STALE',
        },
      });
    });
  });

  describe('_failure details parameter', () => {
    it('includes details key when provided', () => {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const details = {
        definitionKey: 'algebra-baseline',
        referenceStale: true,
        templateStale: false,
        referenceLastModified: '2025-06-01T10:00:00.000Z',
        templateLastModified: null,
      };
      const result = dispatcher._failure(
        'req-details-001',
        'DEFINITION_STALE',
        'Definition is stale.',
        false,
        details
      );

      expect(result).toEqual({
        ok: false,
        requestId: 'req-details-001',
        error: {
          code: 'DEFINITION_STALE',
          message: 'Definition is stale.',
          retriable: false,
          details,
        },
      });
    });

    it('omits details key when undefined (backward-compatible)', () => {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const result = dispatcher._failure(
        'req-no-details',
        'INVALID_REQUEST',
        'Bad request.',
        false
      );

      expect(result).toEqual({
        ok: false,
        requestId: 'req-no-details',
        error: {
          code: 'INVALID_REQUEST',
          message: 'Bad request.',
          retriable: false,
        },
      });
      expect(result.error).not.toHaveProperty('details');
    });

    it('omits details key when null (treat null same as undefined)', () => {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const result = dispatcher._failure(
        'req-details-null',
        'DEFINITION_STALE',
        'Definition is stale.',
        false,
        null
      );

      expect(result).toEqual({
        ok: false,
        requestId: 'req-details-null',
        error: {
          code: 'DEFINITION_STALE',
          message: 'Definition is stale.',
          retriable: false,
        },
      });
      expect(result.error).not.toHaveProperty('details');
    });

    it('includes details key when empty object (valid details payload)', () => {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const result = dispatcher._failure(
        'req-details-empty',
        'INVALID_REQUEST',
        'Bad request.',
        false,
        {}
      );

      expect(result).toEqual({
        ok: false,
        requestId: 'req-details-empty',
        error: {
          code: 'INVALID_REQUEST',
          message: 'Bad request.',
          retriable: false,
          details: {},
        },
      });
    });
  });

  describe('existing error mappings unchanged (regression)', () => {
    it('maps ApiRateLimitError to RATE_LIMITED with retriable true', () => {
      const ApiRateLimitError = require('../../../src/backend/Utils/ErrorTypes/ApiRateLimitError.js');
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const result = dispatcher._mapErrorToFailureEnvelope(
        'req-rate-limit',
        new ApiRateLimitError('Rate limited', {})
      );

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          retriable: true,
        },
      });
    });

    it('maps ApiValidationError to INVALID_REQUEST with retriable false', () => {
      const ApiValidationError = require('../../../src/backend/Utils/ErrorTypes/ApiValidationError.js');
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const result = dispatcher._mapErrorToFailureEnvelope(
        'req-validation',
        new ApiValidationError('Invalid payload', {})
      );

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          retriable: false,
        },
      });
    });

    it('maps ApiDisabledError to UNKNOWN_METHOD with retriable false', () => {
      const ApiDisabledError = require('../../../src/backend/Utils/ErrorTypes/ApiDisabledError.js');
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const result = dispatcher._mapErrorToFailureEnvelope(
        'req-disabled',
        new ApiDisabledError('Method disabled', {})
      );

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'UNKNOWN_METHOD',
          retriable: false,
        },
      });
    });

    it('maps unknown errors to INTERNAL_ERROR with retriable false', () => {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const result = dispatcher._mapErrorToFailureEnvelope(
        'req-unknown',
        new Error('Something went wrong')
      );

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
    });

    it('maps plain Error with reason IN_USE to IN_USE', () => {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const inUseError = new Error('Record is in use');
      inUseError.reason = 'IN_USE';

      const result = dispatcher._mapErrorToFailureEnvelope('req-inuse', inUseError);

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'IN_USE',
          retriable: false,
        },
      });
    });
  });
});
