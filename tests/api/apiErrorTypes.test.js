import { describe, expect, it } from 'vitest';

const ApiRateLimitErrorPath = '../../src/backend/Utils/ErrorTypes/ApiRateLimitError.js';
const ApiValidationErrorPath = '../../src/backend/Utils/ErrorTypes/ApiValidationError.js';
const ApiDisabledErrorPath = '../../src/backend/Utils/ErrorTypes/ApiDisabledError.js';

// ── ApiRateLimitError ──────────────────────────────────────────────────────────

describe('ApiRateLimitError', () => {
  it('has name "ApiRateLimitError" and exposes all constructor fields', () => {
    const ApiRateLimitError = require(ApiRateLimitErrorPath);

    const err = new ApiRateLimitError('Rate limit exceeded', {
      requestId: 'req-rl-1',
      method: 'doSomething',
      activeCount: 5,
      limit: 3,
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiRateLimitError');
    expect(err.message).toBe('Rate limit exceeded');
    expect(err.requestId).toBe('req-rl-1');
    expect(err.method).toBe('doSomething');
    expect(err.activeCount).toBe(5);
    expect(err.limit).toBe(3);
  });

  it('preserves an explicit cause property when provided', () => {
    const ApiRateLimitError = require(ApiRateLimitErrorPath);

    const originalError = new Error('underlying cause');
    const err = new ApiRateLimitError('Rate limit exceeded', {
      requestId: 'req-rl-cause',
      method: 'doSomething',
      activeCount: 1,
      limit: 1,
      cause: originalError,
    });

    expect(err.cause).toBe(originalError);
  });

  it('sets cause to null when no cause is provided', () => {
    const ApiRateLimitError = require(ApiRateLimitErrorPath);

    const err = new ApiRateLimitError('Rate limit exceeded', {
      requestId: 'req-rl-nocause',
      method: 'doSomething',
      activeCount: 1,
      limit: 1,
    });

    expect(err.cause).toBeNull();
  });
});

// ── ApiValidationError ────────────────────────────────────────────────────────

describe('ApiValidationError', () => {
  it('has name "ApiValidationError" and exposes all constructor fields', () => {
    const ApiValidationError = require(ApiValidationErrorPath);

    const err = new ApiValidationError('Validation failed', {
      requestId: 'req-val-1',
      method: 'submitResult',
      fieldName: 'cohortId',
      details: 'must not be empty',
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiValidationError');
    expect(err.message).toBe('Validation failed');
    expect(err.requestId).toBe('req-val-1');
    expect(err.method).toBe('submitResult');
    expect(err.fieldName).toBe('cohortId');
    expect(err.details).toBe('must not be empty');
  });

  it('preserves an explicit cause property when provided', () => {
    const ApiValidationError = require(ApiValidationErrorPath);

    const originalError = new Error('schema parse failed');
    const err = new ApiValidationError('Validation failed', {
      requestId: 'req-val-cause',
      method: 'submitResult',
      cause: originalError,
    });

    expect(err.cause).toBe(originalError);
  });

  it('sets cause, fieldName, and details to null when not provided', () => {
    const ApiValidationError = require(ApiValidationErrorPath);

    const err = new ApiValidationError('Validation failed', {
      requestId: 'req-val-nocause',
      method: 'submitResult',
    });

    expect(err.cause).toBeNull();
    expect(err.fieldName).toBeNull();
    expect(err.details).toBeNull();
  });
});

// ── ApiDisabledError ──────────────────────────────────────────────────────────

describe('ApiDisabledError', () => {
  it('has name "ApiDisabledError" and exposes all constructor fields', () => {
    const ApiDisabledError = require(ApiDisabledErrorPath);

    const err = new ApiDisabledError('Method is disabled', {
      requestId: 'req-dis-1',
      method: 'unknownMethod',
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiDisabledError');
    expect(err.message).toBe('Method is disabled');
    expect(err.requestId).toBe('req-dis-1');
    expect(err.method).toBe('unknownMethod');
  });

  it('preserves an explicit cause property when provided', () => {
    const ApiDisabledError = require(ApiDisabledErrorPath);

    const originalError = new Error('root cause');
    const err = new ApiDisabledError('Method is disabled', {
      requestId: 'req-dis-cause',
      method: 'unknownMethod',
      cause: originalError,
    });

    expect(err.cause).toBe(originalError);
  });

  it('sets cause to null when no cause is provided', () => {
    const ApiDisabledError = require(ApiDisabledErrorPath);

    const err = new ApiDisabledError('Method is disabled', {
      requestId: 'req-dis-nocause',
      method: 'unknownMethod',
    });

    expect(err.cause).toBeNull();
  });
});
