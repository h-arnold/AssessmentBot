import { render, screen } from '@testing-library/react';
import App from './App';

const checkingAuthorisationStatusText = 'Checking authorisation status...';

type ApiResponseEnvelope =
  | {
      ok: true;
      requestId: string;
      data: boolean;
    }
  | {
      ok: false;
      requestId: string;
      error: {
        code: string;
        message: string;
        retriable?: boolean;
      };
    };

/**
 * Installs a `google.script.run.apiHandler` mock for app-level tests.
 */
function installApiHandlerMock(response: ApiResponseEnvelope | { transportFailure: unknown }) {
  let successHandler: ((payload: unknown) => void) | undefined;
  let failureHandler: ((error: unknown) => void) | undefined;

  const runMock = {
    withSuccessHandler(handler: (payload: unknown) => void) {
      successHandler = handler;
      return runMock;
    },
    withFailureHandler(handler: (error: unknown) => void) {
      failureHandler = handler;
      return runMock;
    },
    apiHandler(request: unknown) {
      queueMicrotask(() => {
        if (typeof (request as { method?: unknown })?.method !== 'string') {
          failureHandler?.(new Error('Invalid transport request payload.'));
          return;
        }

        if ('transportFailure' in response) {
          failureHandler?.(response.transportFailure);
          return;
        }

        successHandler?.(response);
      });
    },
  };

  (globalThis as { google?: unknown }).google = {
    script: {
      run: runMock,
    },
  };
}

describe('App', () => {
  afterEach(() => {
    delete (globalThis as { google?: unknown }).google;
  });

  it('shows loading then authorised status when backend returns true', async () => {
    installApiHandlerMock({
      ok: true,
      requestId: 'req-1',
      data: true,
    });

    render(<App />);

    expect(screen.getByText('AssessmentBot Frontend')).toBeInTheDocument();
    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
  });

  it('shows unauthorised status when backend returns false', async () => {
    installApiHandlerMock({
      ok: true,
      requestId: 'req-2',
      data: false,
    });

    render(<App />);

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
  });

  it('shows backend failure message when backend returns a failure envelope', async () => {
    installApiHandlerMock({
      ok: false,
      requestId: 'req-3',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Backend authorisation check failed.',
      },
    });

    render(<App />);

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(
      await screen.findByText('Unable to check authorisation status right now.')
    ).toBeInTheDocument();
  });

  it('shows string failure message when transport fails with a non-Error value', async () => {
    installApiHandlerMock({
      transportFailure: 'Backend call failed with a string.',
    });

    render(<App />);

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(
      await screen.findByText('Unable to check authorisation status right now.')
    ).toBeInTheDocument();
  });



  it('shows rate-limited message when backend returns retriable rate limit envelope', async () => {
    installApiHandlerMock({
      ok: false,
      requestId: 'req-rl-1',
      error: {
        code: 'RATE_LIMITED',
        message: 'Rate limited.',
        retriable: true,
      },
    });

    render(<App />);

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(
      await screen.findByText('The service is busy. Please try again shortly.')
    ).toBeInTheDocument();
  });

  it('shows runtime failure message when google.script.run is unavailable', async () => {
    render(<App />);

    expect(screen.getByText(checkingAuthorisationStatusText)).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(
      await screen.findByText('Unable to check authorisation status right now.')
    ).toBeInTheDocument();
  });
});
