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
  return createRunner();

  /**
   * Creates a runner snapshot with the currently registered handlers.
   *
   * @param {((response: unknown) => void) | undefined} successHandler The current success handler.
   * @param {((error: unknown) => void) | undefined} failureHandler The current failure handler.
   * @returns {GoogleScriptRunApiHandler} The runner snapshot.
   */
  function createRunner(
    successHandler?: (response: unknown) => void,
    failureHandler?: (error: unknown) => void
  ): GoogleScriptRunApiHandler {
    return {
      withSuccessHandler(nextSuccessHandler: (response: unknown) => void) {
        return createRunner(nextSuccessHandler, failureHandler);
      },
      withFailureHandler(nextFailureHandler: (error: unknown) => void) {
        return createRunner(successHandler, nextFailureHandler);
      },
      apiHandler(request: unknown) {
        invokeRequest(request, {
          successHandler,
          failureHandler,
        });
      },
    };
  }
}

export const googleScriptRunApiHandlerFactorySource = String.raw`
function createGoogleScriptRunApiHandlerMock(invokeRequest) {
  return createRunner();

  function createRunner(successHandler, failureHandler) {
    return {
      withSuccessHandler(nextSuccessHandler) {
        return createRunner(nextSuccessHandler, failureHandler);
      },
      withFailureHandler(nextFailureHandler) {
        return createRunner(successHandler, nextFailureHandler);
      },
      apiHandler(request) {
        invokeRequest(request, {
          successHandler,
          failureHandler,
        });
      },
    };
  }
}
`;
