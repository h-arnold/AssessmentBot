/**
 * Red-phase specs for the assignment wizard orchestrator module.
 *
 * The orchestrator does not exist yet, so every test below fails at the
 * dynamic import of `./assignmentWizardOrchestrator`. These specs pin the
 * entry-mode taxonomy, the recovery reparse request shape, the approval-save
 * baseline, registry-driven error surfacing, and the reparse-persists rule.
 *
 * All requests built by the orchestrator are asserted against the real
 * `UpsertAssignmentDefinitionRequestSchema`, so the mocked service still
 * exercises the Section 4 transport contract rather than a loose stub.
 */

import { act, renderHook, waitFor, type RenderHookResult } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import { StartupWarmupStateProvider } from '../../features/auth/startupWarmupState';
import { createAppQueryClient } from '../../query/queryClient';
import { UpsertAssignmentDefinitionRequestSchema } from '../../services/assignmentDefinition/assignmentDefinition.zod';
import type { AssignmentDefinition } from '../../services/assignmentDefinition/assignmentDefinition.zod';
import editableDefinitionsRaw from '../../../../../tests/__mocks__/data/synthetic-analysis/small/editableDefinitions.json?raw';

vi.mock('../../services/assignmentDefinition/assignmentDefinitionService', () => ({
  getAssignmentDefinition: vi.fn(),
  upsertAssignmentDefinition: vi.fn(),
}));

vi.mock('../../logging/frontendLogger', () => ({
  logFrontendError: vi.fn(),
  logFrontendEvent: vi.fn(),
}));

vi.mock('../../errors/map-error-to-ui', () => ({
  mapErrorToUserMessage: vi.fn((error: unknown) => {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as Record<string, unknown>)['code'])
        : 'unknown';
    return `mapped:${code}`;
  }),
  mapErrorCodeToUserMessage: vi.fn((code: string) => `mapped:${code}`),
  extractErrorCode: vi.fn((error: unknown) =>
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as Record<string, unknown>)['code'])
      : null
  ),
  extractRequestId: vi.fn(() => 'request-id'),
}));

/**
 * Suggested orchestrator module path pinned by these red-phase tests.
 * The green phase creates this file in the wizard feature directory.
 */
const ORCHESTRATOR_MODULE_PATH = './assignmentWizardOrchestrator';

/**
 * Canonical small-profile `transport.editableDefinitions` view, imported as raw
 * text so this spec consumes the committed synthetic fixture instead of a
 * hand-copied literal that can silently drift from it.
 */
const CANONICAL_EDITABLE_DEFINITIONS = JSON.parse(editableDefinitionsRaw) as Record<
  string,
  AssignmentDefinition
>;

/**
 * The canonical `definition-0-slides` record. Its `updatedAt` value is the
 * stale review baseline the orchestrator must capture and resend as
 * `expectedDefinitionUpdatedAt`.
 */
const STALE_DEFINITION_SEED: AssignmentDefinition =
  CANONICAL_EDITABLE_DEFINITIONS['definition-0-slides'];

const STALE_DEFINITION_KEY = STALE_DEFINITION_SEED.definitionKey;

/**
 * Upsert call count for the reparse-then-approve-save recovery journey.
 */
const REPARSE_THEN_SAVE_UPSERT_CALLS = 2;

/**
 * Pinned wizard entry-mode taxonomy for the future orchestrator.
 */
type PinnedEntryMode = 'create' | 'update' | 'explicit-reparse' | 'recovery';

/**
 * Pinned wizard entry intent. Recovery carries an existing key plus an
 * approval-success callback and must never masquerade as create.
 */
type PinnedEntryIntent =
  | { kind: 'create' }
  | { kind: 'update'; definitionKey: string }
  | { kind: 'explicit-reparse'; definitionKey: string }
  | {
      kind: 'recovery';
      definitionKey: string | null;
      onApprovalSuccess: (definitionKey: string) => void;
    };

/**
 * Pinned orchestrator hook contract consumed by the modal component.
 */
interface PinnedOrchestratorReturn {
  entryMode: PinnedEntryMode;
  blockingError: string | null;
  hasParsedTasks: boolean;
  reparseDefinition: () => Promise<void>;
  saveApproval: () => Promise<void>;
  cancelReview: () => void;
}

/**
 * Pinned orchestrator hook properties.
 */
interface PinnedOrchestratorProperties {
  intent: PinnedEntryIntent;
  onClose: () => void;
}

/**
 * Dynamically imports the not-yet-existing orchestrator module through a
 * variable path so TypeScript and ESLint stay clean while Vitest fails red on
 * the missing file.
 *
 * @returns {Promise<Record<string, unknown>>} Imported module namespace.
 */
async function loadOrchestratorModule(): Promise<Record<string, unknown>> {
  const modulePath = ORCHESTRATOR_MODULE_PATH;
  return import(/* @vite-ignore */ modulePath);
}

/**
 * Resolves the pinned `resolveWizardEntryMode` export.
 *
 * @returns {Promise<(intent: PinnedEntryIntent) => PinnedEntryMode>} Entry-mode resolver.
 */
async function loadResolveWizardEntryMode(): Promise<
  (intent: PinnedEntryIntent) => PinnedEntryMode
> {
  const orchestrator = await loadOrchestratorModule();
  return orchestrator['resolveWizardEntryMode'] as (intent: PinnedEntryIntent) => PinnedEntryMode;
}

/**
 * Resolves the pinned `useAssignmentWizardOrchestrator` export.
 *
 * @returns {Promise<(properties: PinnedOrchestratorProperties) => PinnedOrchestratorReturn>} Orchestrator hook.
 */
async function loadUseAssignmentWizardOrchestrator(): Promise<
  (properties: PinnedOrchestratorProperties) => PinnedOrchestratorReturn
> {
  const orchestrator = await loadOrchestratorModule();
  return orchestrator['useAssignmentWizardOrchestrator'] as (
    properties: PinnedOrchestratorProperties
  ) => PinnedOrchestratorReturn;
}

/**
 * Reads the service mocks after importing the mocked service module.
 *
 * @returns {Promise<{ getDefinition: ReturnType<typeof vi.fn>; upsertDefinition: ReturnType<typeof vi.fn> }>} Service mocks.
 */
async function getServiceMocks(): Promise<{
  getDefinition: ReturnType<typeof vi.fn>;
  upsertDefinition: ReturnType<typeof vi.fn>;
}> {
  const serviceModule =
    await import('../../services/assignmentDefinition/assignmentDefinitionService');
  return {
    getDefinition: serviceModule.getAssignmentDefinition as ReturnType<typeof vi.fn>,
    upsertDefinition: serviceModule.upsertAssignmentDefinition as ReturnType<typeof vi.fn>,
  };
}

/**
 * Creates a React Query + startup warm-up provider wrapper for hook tests.
 *
 * @returns {(properties: Readonly<PropsWithChildren>) => React.JSX.Element} Provider wrapper.
 */
function createOrchestratorWrapper(): (
  properties: Readonly<PropsWithChildren>
) => React.JSX.Element {
  const queryClient = createAppQueryClient();
  return function OrchestratorWrapper({ children }: Readonly<PropsWithChildren>) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(StartupWarmupStateProvider, { warmupState: 'ready' }, children)
    );
  };
}

/**
 * Builds a coded transport rejection shaped like the backend envelopes.
 *
 * @param {string} code - Error code to carry on the rejection.
 * @returns {Error & { code: string; requestId: string }} Coded error.
 */
function buildCodedRejection(code: string): Error & { code: string; requestId: string } {
  return Object.assign(new Error(code), { code, requestId: 'request-id' });
}

/**
 * Builds a recovery intent with an existing key and a fresh callback.
 *
 * @param {(definitionKey: string) => void} onApprovalSuccess - Approval callback to pin.
 * @returns {Extract<PinnedEntryIntent, { kind: 'recovery' }>} Recovery intent.
 */
function buildRecoveryIntent(
  onApprovalSuccess: (definitionKey: string) => void
): Extract<PinnedEntryIntent, { kind: 'recovery' }> {
  return {
    kind: 'recovery',
    definitionKey: STALE_DEFINITION_KEY,
    onApprovalSuccess,
  };
}

/**
 * Renders the orchestrator hook with a recovery intent.
 *
 * @param {(properties: PinnedOrchestratorProperties) => PinnedOrchestratorReturn} useOrchestrator - Pinned hook.
 * @param {(definitionKey: string) => void} onApprovalSuccess - Approval callback.
 * @returns {RenderHookResult<PinnedOrchestratorReturn, unknown>} Render result.
 */
function renderRecoveryOrchestrator(
  useOrchestrator: (properties: PinnedOrchestratorProperties) => PinnedOrchestratorReturn,
  onApprovalSuccess: (definitionKey: string) => void
): RenderHookResult<PinnedOrchestratorReturn, unknown> {
  return renderHook(
    () => useOrchestrator({ intent: buildRecoveryIntent(onApprovalSuccess), onClose: vi.fn() }),
    { wrapper: createOrchestratorWrapper() }
  );
}

/**
 * Renders the orchestrator hook with an update intent.
 *
 * @param {(properties: PinnedOrchestratorProperties) => PinnedOrchestratorReturn} useOrchestrator - Pinned hook.
 * @returns {RenderHookResult<PinnedOrchestratorReturn, unknown>} Render result.
 */
function renderUpdateOrchestrator(
  useOrchestrator: (properties: PinnedOrchestratorProperties) => PinnedOrchestratorReturn
): RenderHookResult<PinnedOrchestratorReturn, unknown> {
  return renderHook(
    () =>
      useOrchestrator({
        intent: { kind: 'update', definitionKey: STALE_DEFINITION_KEY },
        onClose: vi.fn(),
      }),
    { wrapper: createOrchestratorWrapper() }
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('assignment wizard orchestrator entry-mode selection', () => {
  it('selects create mode for a create intent', async () => {
    const resolveEntryMode = await loadResolveWizardEntryMode();
    expect(resolveEntryMode({ kind: 'create' })).toBe('create');
  });

  it('selects update mode for an update intent with an existing key', async () => {
    const resolveEntryMode = await loadResolveWizardEntryMode();
    expect(resolveEntryMode({ kind: 'update', definitionKey: STALE_DEFINITION_KEY })).toBe(
      'update'
    );
  });

  it('selects explicit-reparse mode for a manual reparse intent', async () => {
    const resolveEntryMode = await loadResolveWizardEntryMode();
    expect(
      resolveEntryMode({ kind: 'explicit-reparse', definitionKey: STALE_DEFINITION_KEY })
    ).toBe('explicit-reparse');
  });

  it('selects recovery mode for a recovery intent with an existing key', async () => {
    const resolveEntryMode = await loadResolveWizardEntryMode();
    expect(
      resolveEntryMode({
        kind: 'recovery',
        definitionKey: STALE_DEFINITION_KEY,
        onApprovalSuccess: vi.fn(),
      })
    ).toBe('recovery');
  });

  it('throws fail-fast for a recovery intent with a null definition key', async () => {
    const resolveEntryMode = await loadResolveWizardEntryMode();
    expect(() =>
      resolveEntryMode({ kind: 'recovery', definitionKey: null, onApprovalSuccess: vi.fn() })
    ).toThrow();
  });
});

describe('assignment wizard orchestrator reparse flow', () => {
  it('reparses the existing definition with forceReparse and ID-shaped identifiers', async () => {
    const serviceMocks = await getServiceMocks();
    serviceMocks.getDefinition.mockImplementation(() =>
      Promise.resolve({ ...STALE_DEFINITION_SEED })
    );
    serviceMocks.upsertDefinition.mockImplementation(() =>
      Promise.resolve({ ...STALE_DEFINITION_SEED })
    );
    const useOrchestrator = await loadUseAssignmentWizardOrchestrator();
    const { result } = renderRecoveryOrchestrator(useOrchestrator, vi.fn());

    await act(async () => {
      await result.current.reparseDefinition();
    });

    expect(serviceMocks.upsertDefinition).toHaveBeenCalledTimes(1);
    const request = serviceMocks.upsertDefinition.mock.calls[0][0] as Record<string, unknown>;
    expect(request).toMatchObject({
      definitionKey: STALE_DEFINITION_KEY,
      forceReparse: true,
      referenceDocumentId: STALE_DEFINITION_SEED.referenceDocumentId,
      templateDocumentId: STALE_DEFINITION_SEED.templateDocumentId,
      documentType: STALE_DEFINITION_SEED.documentType,
    });
    // Explicit forced requests must omit weighting patches (including empty arrays).
    expect(request).not.toHaveProperty('taskWeightings');
    expect(UpsertAssignmentDefinitionRequestSchema.safeParse(request).success).toBe(true);
    expect(result.current.hasParsedTasks).toBe(true);
  });
});

describe('assignment wizard orchestrator save flow', () => {
  it('sends the captured expectedDefinitionUpdatedAt baseline on approval save', async () => {
    const serviceMocks = await getServiceMocks();
    serviceMocks.getDefinition.mockImplementation(() =>
      Promise.resolve({ ...STALE_DEFINITION_SEED })
    );
    serviceMocks.upsertDefinition
      .mockImplementationOnce(() => Promise.resolve({ ...STALE_DEFINITION_SEED }))
      .mockImplementationOnce(() => Promise.resolve({ ...STALE_DEFINITION_SEED }));
    const useOrchestrator = await loadUseAssignmentWizardOrchestrator();
    const { result } = renderRecoveryOrchestrator(useOrchestrator, vi.fn());

    await act(async () => {
      await result.current.reparseDefinition();
    });
    await act(async () => {
      await result.current.saveApproval();
    });

    expect(serviceMocks.upsertDefinition).toHaveBeenCalledTimes(REPARSE_THEN_SAVE_UPSERT_CALLS);
    const saveRequest = serviceMocks.upsertDefinition.mock.calls[1][0] as Record<string, unknown>;
    expect(saveRequest).toMatchObject({
      definitionKey: STALE_DEFINITION_KEY,
      expectedDefinitionUpdatedAt: STALE_DEFINITION_SEED.updatedAt,
    });
    // Approval saves are not forced reparses.
    expect(saveRequest).not.toHaveProperty('forceReparse');
    expect(UpsertAssignmentDefinitionRequestSchema.safeParse(saveRequest).success).toBe(true);
  });

  it('surfaces the prompt-level error via the shared registry when approval save is stale', async () => {
    const serviceMocks = await getServiceMocks();
    serviceMocks.getDefinition.mockImplementation(() =>
      Promise.resolve({ ...STALE_DEFINITION_SEED })
    );
    serviceMocks.upsertDefinition
      .mockImplementationOnce(() => Promise.resolve({ ...STALE_DEFINITION_SEED }))
      .mockImplementationOnce(() => Promise.reject(buildCodedRejection('DEFINITION_STALE')));
    const registry = await import('../../errors/map-error-to-ui');
    const onApprovalSuccess = vi.fn();
    const useOrchestrator = await loadUseAssignmentWizardOrchestrator();
    const { result } = renderRecoveryOrchestrator(useOrchestrator, onApprovalSuccess);

    await act(async () => {
      await result.current.reparseDefinition();
    });
    await act(async () => {
      await result.current.saveApproval();
    });

    expect(registry.mapErrorToUserMessage).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DEFINITION_STALE' })
    );
    expect(result.current.blockingError).toBe('mapped:DEFINITION_STALE');
    expect(onApprovalSuccess).not.toHaveBeenCalled();
  });

  it('surfaces the parse-failure treatment via the shared registry when reparse fails', async () => {
    const serviceMocks = await getServiceMocks();
    serviceMocks.getDefinition.mockImplementation(() =>
      Promise.resolve({ ...STALE_DEFINITION_SEED })
    );
    serviceMocks.upsertDefinition.mockImplementation(() =>
      Promise.reject(buildCodedRejection('DEFINITION_PARSE_FAILED'))
    );
    const registry = await import('../../errors/map-error-to-ui');
    const onApprovalSuccess = vi.fn();
    const useOrchestrator = await loadUseAssignmentWizardOrchestrator();
    const { result } = renderRecoveryOrchestrator(useOrchestrator, onApprovalSuccess);

    await act(async () => {
      await result.current.reparseDefinition();
    });

    expect(registry.mapErrorToUserMessage).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DEFINITION_PARSE_FAILED' })
    );
    expect(result.current.blockingError).toBe('mapped:DEFINITION_PARSE_FAILED');
    // A failed parse must never open stage two.
    expect(result.current.hasParsedTasks).toBe(false);
    expect(onApprovalSuccess).not.toHaveBeenCalled();
  });
});

describe('assignment wizard orchestrator approval and review lifecycle', () => {
  it('invokes the approval-success callback exactly once with the same definition key', async () => {
    const serviceMocks = await getServiceMocks();
    serviceMocks.getDefinition.mockImplementation(() =>
      Promise.resolve({ ...STALE_DEFINITION_SEED })
    );
    serviceMocks.upsertDefinition.mockImplementation(() =>
      Promise.resolve({ ...STALE_DEFINITION_SEED })
    );
    const onApprovalSuccess = vi.fn();
    const useOrchestrator = await loadUseAssignmentWizardOrchestrator();
    const { result } = renderRecoveryOrchestrator(useOrchestrator, onApprovalSuccess);

    await act(async () => {
      await result.current.reparseDefinition();
    });
    await act(async () => {
      await result.current.saveApproval();
    });

    expect(onApprovalSuccess).toHaveBeenCalledTimes(1);
    expect(onApprovalSuccess).toHaveBeenCalledWith(STALE_DEFINITION_KEY);
  });

  it('keeps the persisted reparse on review cancel without rolling back or starting assessment', async () => {
    const serviceMocks = await getServiceMocks();
    serviceMocks.getDefinition.mockImplementation(() =>
      Promise.resolve({ ...STALE_DEFINITION_SEED })
    );
    serviceMocks.upsertDefinition.mockImplementation(() =>
      Promise.resolve({ ...STALE_DEFINITION_SEED })
    );
    const onApprovalSuccess = vi.fn();
    const useOrchestrator = await loadUseAssignmentWizardOrchestrator();
    const { result } = renderRecoveryOrchestrator(useOrchestrator, onApprovalSuccess);

    await act(async () => {
      await result.current.reparseDefinition();
    });
    expect(serviceMocks.upsertDefinition).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.cancelReview();
    });

    // The server-side reparse remains; cancelling review discards only local review state.
    expect(serviceMocks.upsertDefinition).toHaveBeenCalledTimes(1);
    expect(onApprovalSuccess).not.toHaveBeenCalled();
  });

  it('reports a blocking error and never falls back to create when the update definition fails to load', async () => {
    const serviceMocks = await getServiceMocks();
    serviceMocks.getDefinition.mockImplementation(() => Promise.reject(new Error('load failed')));
    const useOrchestrator = await loadUseAssignmentWizardOrchestrator();
    const { result } = renderUpdateOrchestrator(useOrchestrator);

    await waitFor(() => {
      expect(result.current.blockingError).not.toBeNull();
    });

    expect(result.current.entryMode).toBe('update');
    expect(serviceMocks.upsertDefinition).not.toHaveBeenCalled();
  });
});
