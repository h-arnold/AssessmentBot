import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  afterEach(() => {
    delete globalThis.google;
  });

  it('shows loading then authorised status when backend returns true', async () => {
    const runMock = {
      withSuccessHandler(handler: (result: boolean) => void) {
        queueMicrotask(() => {
          handler(true);
        });
        return runMock;
      },
      withFailureHandler() {
        return runMock;
      },
      getAuthorisationStatus() {},
    };

    globalThis.google = {
      script: {
        run: runMock,
      },
    };

    render(<App />);

    expect(screen.getByText('AssessmentBot Frontend')).toBeInTheDocument();
    expect(screen.getByText('Checking authorisation status...')).toBeInTheDocument();
    expect(await screen.findByText('Authorised')).toBeInTheDocument();
  });

  it('shows unauthroised status when backend returns false', async () => {
    const runMock = {
      withSuccessHandler(handler: (result: boolean) => void) {
        queueMicrotask(() => {
          handler(false);
        });
        return runMock;
      },
      withFailureHandler() {
        return runMock;
      },
      getAuthorisationStatus() {},
    };

    globalThis.google = {
      script: {
        run: runMock,
      },
    };

    render(<App />);

    expect(screen.getByText('Checking authorisation status...')).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised')).toBeInTheDocument();
  });

  it('shows backend failure message when backend call fails', async () => {
    const backendFailure = new Error('Backend authorisation check failed.');
    const runMock = {
      withSuccessHandler() {
        return runMock;
      },
      withFailureHandler(handler: (error: unknown) => void) {
        queueMicrotask(() => {
          handler(backendFailure);
        });
        return runMock;
      },
      getAuthorisationStatus() {},
    };

    globalThis.google = {
      script: {
        run: runMock,
      },
    };

    render(<App />);

    expect(screen.getByText('Checking authorisation status...')).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised')).toBeInTheDocument();
    expect(await screen.findByText('Backend authorisation check failed.')).toBeInTheDocument();
  });


  it('shows string failure message when backend call fails with non-Error values', async () => {
    const runMock = {
      withSuccessHandler() {
        return runMock;
      },
      withFailureHandler(handler: (error: unknown) => void) {
        queueMicrotask(() => {
          handler('Backend call failed with a string.');
        });
        return runMock;
      },
      getAuthorisationStatus() {},
    };

    globalThis.google = {
      script: {
        run: runMock,
      },
    };

    render(<App />);

    expect(screen.getByText('Checking authorisation status...')).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised')).toBeInTheDocument();
    expect(await screen.findByText('Backend call failed with a string.')).toBeInTheDocument();
  });

  it('shows runtime failure message when google.script.run is unavailable', async () => {
    render(<App />);

    expect(screen.getByText('Checking authorisation status...')).toBeInTheDocument();
    expect(await screen.findByText('Unauthorised')).toBeInTheDocument();
    expect(
      await screen.findByText('google.script.run is unavailable in this runtime.')
    ).toBeInTheDocument();
  });
});
