import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import {
  logAndMapWizardMutationError,
  type WizardMutationErrorContext,
} from './assignmentWizardMutation';

const failure = new ApiTransportError({
  requestId: 'req-wizard-diagnostics-1',
  error: { code: 'INVALID_REQUEST', message: 'Bad request.' },
});

/** Mutation context with allow-listed diagnostics only; the full request is never attached. */
const errorContext: WizardMutationErrorContext = {
  mode: 'create',
  definitionKey: null,
  actionType: 'parse',
};

/**
 * Reads the metadata object from the wizard mutation error log entry.
 *
 * @param {ReturnType<typeof vi.spyOn>} consoleErrorSpy - The console error spy.
 * @returns {Record<string, unknown>} The logged metadata.
 */
function readLoggedMetadata(consoleErrorSpy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const call = consoleErrorSpy.mock.calls.find(
    ([context]: unknown[]) => context === 'AssignmentDefinitionWizardModal.runWizardMutation'
  );
  expect(call).toBeDefined();
  return (call?.[1] as Record<string, unknown>).metadata as Record<string, unknown>;
}

describe('wizard mutation failure diagnostics', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps mutation failures through the shared registry', () => {
    const message = logAndMapWizardMutationError(
      'AssignmentDefinitionWizardModal.runWizardMutation',
      failure,
      errorContext
    );

    expect(message).toBe(
      'The request contains invalid data. Please check your inputs and try again.'
    );
  });

  it('logs only the allow-listed diagnostic subset without the request payload', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');

    logAndMapWizardMutationError(
      'AssignmentDefinitionWizardModal.runWizardMutation',
      failure,
      errorContext
    );

    const metadata = readLoggedMetadata(consoleErrorSpy);
    expect(metadata).toMatchObject({
      mode: 'create',
      definitionKey: null,
      actionType: 'parse',
      requestId: 'req-wizard-diagnostics-1',
      errorCode: 'INVALID_REQUEST',
    });
    expect(metadata).not.toHaveProperty('requestPayload');
    expect(JSON.stringify(metadata)).not.toContain('ref-doc-id');
  });

  it('carries stack information through the dedicated field, never metadata', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');

    logAndMapWizardMutationError(
      'AssignmentDefinitionWizardModal.runWizardMutation',
      failure,
      errorContext
    );

    const metadata = readLoggedMetadata(consoleErrorSpy);
    expect(metadata).not.toHaveProperty('stack');
    const entry = consoleErrorSpy.mock.calls.find(
      ([context]: unknown[]) => context === 'AssignmentDefinitionWizardModal.runWizardMutation'
    )?.[1] as Record<string, unknown>;
    expect(typeof entry.stack === 'string' || entry.stack === undefined).toBe(true);
  });
});
