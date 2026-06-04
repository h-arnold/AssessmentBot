import { QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import {
  createElement as createReactElement,
  createRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { expect } from 'vitest';
import { createAppQueryClient } from '../../../../query/queryClient';
import type { BackendSettingsProbeHandle } from './fixtures';

/**
 * Creates a deferred promise used to keep save mutations pending during assertions.
 *
 * @template T
 * @returns {{ promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void }} Deferred promise controls.
 */
export function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

/**
 * Imports the backend settings hook under test after the module mocks are registered.
 *
 * @returns {Promise<typeof import('../useBackendSettings')>} The hook module.
 */
export async function loadUseBackendSettingsModule() {
  return import('../useBackendSettings');
}

/**
 * Renders the backend settings hook with a per-test query client.
 *
 * @returns {Promise<Readonly<{ getCurrentState: () => BackendSettingsHookValue; queryClient: ReturnType<typeof createAppQueryClient>; }>>} The rendered hook state accessor and query client.
 */
export async function renderBackendSettingsHook() {
  const queryClient = createAppQueryClient();
  const { useBackendSettings } = await loadUseBackendSettingsModule();
  const probeReference = createRef<BackendSettingsProbeHandle>();

  /**
   * Captures the hook state on each render so the test can make assertions against it.
   *
   * @returns {null} Nothing.
   */
  const BackendSettingsProbe = forwardRef<BackendSettingsProbeHandle>(
    function BackendSettingsProbe(_properties, reference) {
      const currentState = useBackendSettings();

      useImperativeHandle(
        reference,
        () => ({
          getCurrentState: () => currentState,
        }),
        [currentState]
      );

      return null;
    }
  );

  render(
    createReactElement(
      QueryClientProvider,
      { client: queryClient },
      createReactElement(BackendSettingsProbe, { ref: probeReference })
    )
  );

  await waitFor(() => {
    expect(probeReference.current).toBeDefined();
  });

  return {
    getCurrentState: () => {
      if (probeReference.current === null) {
        throw new Error('Backend settings hook state was not initialised.');
      }

      return probeReference.current.getCurrentState();
    },
    queryClient,
  };
}
