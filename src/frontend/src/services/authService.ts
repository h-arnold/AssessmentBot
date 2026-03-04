type GoogleScriptRun = {
  withSuccessHandler: (handler: (result: boolean) => void) => GoogleScriptRun;
  withFailureHandler: (handler: (error: unknown) => void) => GoogleScriptRun;
  getAuthorisationStatus: () => void;
};

type GoogleScript = {
  script?: {
    run?: GoogleScriptRun;
  };
};

declare global {
  // Global injected by Apps Script HtmlService runtime.
  // Declared for both `window.google` and `globalThis.google` access patterns.
  var google: GoogleScript | undefined;
  interface Window {
    google?: GoogleScript;
  }
}

/**
 * Calls the backend API layer and returns current authorisation status.
 */
export async function getAuthorisationStatus(): Promise<boolean> {
  const runner = globalThis.google?.script?.run;
  if (!runner) {
    throw new Error('google.script.run is unavailable in this runtime.');
  }

  return await new Promise<boolean>((resolve, reject) => {
    runner
      .withSuccessHandler((result: boolean) => {
        resolve(result);
      })
      .withFailureHandler((error: unknown) => {
        reject(error);
      })
      .getAuthorisationStatus();
  });
}
