export type GoogleScriptRunApiHandlerFactoryCallbacks = Readonly<{
  successHandler: ((response: unknown) => void) | undefined;
  failureHandler: ((error: unknown) => void) | undefined;
}>;

export type GoogleScriptRunApiHandlerFactoryRunner = {
  withSuccessHandler: (
    handler: (response: unknown) => void
  ) => GoogleScriptRunApiHandlerFactoryRunner;
  withFailureHandler: (
    handler: (error: unknown) => void
  ) => GoogleScriptRunApiHandlerFactoryRunner;
  apiHandler: (request: unknown) => void;
};

export function createGoogleScriptRunApiHandlerMock(
  invokeRequest: (
    request: unknown,
    callbacks: GoogleScriptRunApiHandlerFactoryCallbacks
  ) => void
): GoogleScriptRunApiHandlerFactoryRunner;
