import { describe, expect, it } from 'vitest';

const DefinitionStaleErrorPath = '../../src/backend/Utils/ErrorTypes/DefinitionStaleError.js';

// ── DefinitionStaleError ──────────────────────────────────────────────────────

describe('DefinitionStaleError', () => {
  it('has name "DefinitionStaleError"', () => {
    const DefinitionStaleError = require(DefinitionStaleErrorPath);

    const err = new DefinitionStaleError('Definition is stale', {
      definitionKey: 'def-123',
      referenceStale: true,
      templateStale: false,
      referenceLastModified: '2024-01-15T10:00:00Z',
      templateLastModified: null,
    });

    expect(err.name).toBe('DefinitionStaleError');
    expect(err.message).toBe('Definition is stale');
  });

  it('stores definitionKey, referenceStale, templateStale, referenceLastModified, templateLastModified', () => {
    const DefinitionStaleError = require(DefinitionStaleErrorPath);

    const referenceLastModified = '2024-01-15T10:00:00Z';
    const templateLastModified = '2024-01-14T09:00:00Z';

    const err = new DefinitionStaleError('Definition is stale', {
      definitionKey: 'def-123',
      referenceStale: true,
      templateStale: true,
      referenceLastModified,
      templateLastModified,
    });

    expect(err.message).toBe('Definition is stale');
    expect(err.definitionKey).toBe('def-123');
    expect(err.referenceStale).toBe(true);
    expect(err.templateStale).toBe(true);
    expect(err.referenceLastModified).toBe(referenceLastModified);
    expect(err.templateLastModified).toBe(templateLastModified);
  });

  it('is an instance of Error', () => {
    const DefinitionStaleError = require(DefinitionStaleErrorPath);

    const err = new DefinitionStaleError('Definition is stale', {
      definitionKey: 'def-123',
      referenceStale: true,
      templateStale: false,
      referenceLastModified: null,
      templateLastModified: null,
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Definition is stale');
  });

  it('has a non-empty stack trace', () => {
    const DefinitionStaleError = require(DefinitionStaleErrorPath);

    const err = new DefinitionStaleError('Definition is stale', {
      definitionKey: 'def-123',
      referenceStale: true,
      templateStale: false,
      referenceLastModified: '2024-01-15T10:00:00Z',
      templateLastModified: null,
    });

    expect(err.stack).toBeTruthy();
    expect(typeof err.stack).toBe('string');
    expect(err.stack.length).toBeGreaterThan(0);
    expect(err.message).toBe('Definition is stale');
  });

  it('handles referenceStale=false and templateStale=true combination', () => {
    const DefinitionStaleError = require(DefinitionStaleErrorPath);

    const err = new DefinitionStaleError('Definition is stale', {
      definitionKey: 'def-456',
      referenceStale: false,
      templateStale: true,
      referenceLastModified: '2024-01-15T10:00:00Z',
      templateLastModified: '2024-01-16T10:00:00Z',
    });

    expect(err.name).toBe('DefinitionStaleError');
    expect(err.message).toBe('Definition is stale');
    expect(err.definitionKey).toBe('def-456');
    expect(err.referenceStale).toBe(false);
    expect(err.templateStale).toBe(true);
    expect(err.referenceLastModified).toBe('2024-01-15T10:00:00Z');
    expect(err.templateLastModified).toBe('2024-01-16T10:00:00Z');
  });
});
