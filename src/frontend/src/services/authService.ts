type GoogleScriptRun = {
  withSuccessHandler: (handler: (result: boolean) => void) => GoogleScriptRun;
  withFailureHandler: (handler: (error: unknown) => void) => GoogleScriptRun;
  getAuthorisationStatus: () => void;
};

declare global {
  interface Window {
    google?: {
      script?: {
        run?: GoogleScriptRun;
      };
    };
  }
}

/**
 * Calls the backend API layer and returns current authorisation status.
 */
export async function getAuthorisationStatus(): Promise<boolean> {
  const runner = window.google?.script?.run;
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
