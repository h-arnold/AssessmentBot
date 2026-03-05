import { afterEach, describe, expect, it, vi } from 'vitest';

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));

vi.mock('react-dom/client', () => ({
  createRoot: createRootMock,
}));

vi.mock('./App', () => ({
  default: () => null,
}));

describe('main entrypoint', () => {
  afterEach(() => {
    createRootMock.mockClear();
    renderMock.mockClear();
    vi.resetModules();
    document.body.innerHTML = '';
  });

  it('throws when the root element is missing', async () => {
    await expect(import('./main')).rejects.toThrow('Root element "#root" was not found.');
  });

  it('creates a React root and renders the app shell', async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await import('./main');

    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
