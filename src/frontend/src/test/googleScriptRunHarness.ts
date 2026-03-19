import { createGoogleScriptRunApiHandlerMock as createGoogleScriptRunApiHandlerImplementation } from './google-script-run-harness-factory.js';

export type GoogleScriptRunApiHandler = {
  withSuccessHandler: (
    handler: (response: unknown) => void
  ) => GoogleScriptRunApiHandler;
  withFailureHandler: (handler: (error: unknown) => void) => GoogleScriptRunApiHandler;
  apiHandler: (request: unknown) => void;
};

export type GoogleScriptRunApiHandlerCallbacks = Readonly<{
  successHandler: ((response: unknown) => void) | undefined;
  failureHandler: ((error: unknown) => void) | undefined;
}>;

/**
 * Creates a `google.script.run.apiHandler` mock with per-call callback isolation.
 *
 * Each chained `withSuccessHandler(...).withFailureHandler(...).apiHandler(...)` call
 * receives a fresh runner instance so overlapping requests cannot overwrite one
 * another's handlers.
 *
 * @param {(request: unknown, callbacks: GoogleScriptRunApiHandlerCallbacks) => void} invokeRequest
 * The request callback to execute when `apiHandler` is invoked.
 * @returns {GoogleScriptRunApiHandler} The mocked runner.
 */
export function createGoogleScriptRunApiHandlerMock(
  invokeRequest: (request: unknown, callbacks: GoogleScriptRunApiHandlerCallbacks) => void
): GoogleScriptRunApiHandler {
  return createGoogleScriptRunApiHandlerImplementation(invokeRequest) as GoogleScriptRunApiHandler;
}

export const googleScriptRunApiHandlerFactorySource =
  createGoogleScriptRunApiHandlerImplementation.toString();
