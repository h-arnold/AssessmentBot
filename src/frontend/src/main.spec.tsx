import { afterEach, describe, expect, it, vi } from 'vitest';

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));

type ReactElementLike = {
  type?: unknown;
  props?: {
    children?: unknown;
  };
};

type QueryProviderModule = {
  AppQueryProvider: (properties: { children?: unknown }) => unknown;
};

type AuthGateModule = {
  AppAuthGate: (properties: { children?: unknown }) => unknown;
};

vi.mock('react-dom/client', () => {
  return {
    createRoot: createRootMock,
  };
});

vi.mock('./App', () => {
  return {
    default: function MockApp() {
      return null;
    },
  };
});

/**
 * Imports a required module and fails with a clear message if it is missing.
 *
 * @param {string} relativePath - The module path relative to this spec file.
 * @returns {Promise<TModule>} The imported module.
 */
async function importRequiredModule<TModule>(relativePath: string): Promise<TModule> {
  try {
    return (await import(new URL(relativePath, import.meta.url).href)) as TModule;
  } catch (error) {
    throw new Error(`${relativePath} should exist.`, { cause: error });
  }
}


/**
 * Returns the only child from a React element props payload.
 *
 * @param {unknown} children - The rendered children payload.
 * @returns {unknown} The first defined child or the original payload.
 */
function getOnlyRenderedChild(children: unknown) {
  if (Array.isArray(children)) {
    return children.find((child) => child !== undefined && child !== null);
  }

  return children;
}

/**
 * Returns a display name for a rendered React element type.
 *
 * @param {unknown} type - The rendered element type.
 * @returns {string} The display name for the rendered type.
 */
function getRenderedTypeName(type: unknown) {
  if (typeof type === 'string') {
    return type;
  }

  if (typeof type === 'function' || typeof type === 'object') {
    return (
      (type as { displayName?: string; name?: string }).displayName ??
      (type as { displayName?: string; name?: string }).name ??
      'anonymous'
    );
  }

  return 'unknown';
}

/**
 * Returns the rendered component chain by following single-child composition.
 *
 * @param {unknown} renderedTree - The rendered tree to inspect.
 * @returns {string[]} The rendered component chain.
 */
function getRenderedComponentChain(renderedTree: unknown) {
  const chain: string[] = [];
  let current = renderedTree as
    | {
        type?: string | { name?: string };
        props?: { children?: unknown };
      }
    | undefined;

  while (current && typeof current === 'object' && 'type' in current) {
    chain.push(getRenderedTypeName(current.type));
    current = getOnlyRenderedChild(current.props?.children) as typeof current;
  }

  return chain;
}

/**
 * Returns the rendered main-entry composition chain elements.
 *
 * @param {ReactElementLike} renderedTree - The rendered tree to inspect.
 * @returns {{ renderedComponentChain: string[]; strictModeChild: ReactElementLike; providerChild: ReactElementLike; appElement: ReactElementLike; }} The composition chain and key child elements.
 */
function getMainEntrypointComposition(renderedTree: ReactElementLike) {
  const renderedComponentChain = getRenderedComponentChain(renderedTree);
  const strictModeChild = getOnlyRenderedChild(renderedTree.props?.children) as ReactElementLike;
  const providerChild = getOnlyRenderedChild(strictModeChild?.props?.children) as ReactElementLike;
  const appElement = getOnlyRenderedChild(providerChild?.props?.children) as ReactElementLike;

  return {
    renderedComponentChain,
    strictModeChild,
    providerChild,
    appElement,
  };
}


describe('main entrypoint', () => {
  afterEach(() => {
    createRootMock.mockClear();
    renderMock.mockClear();
    vi.resetModules();
    document.body.replaceChildren();
  });

  it('throws when the root element is missing', async () => {
    await expect(import('./main')).rejects.toThrow('Root element "#root" was not found.');
  });

  it('creates a React root and renders the app shell', async () => {
    const rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.replaceChildren(rootElement);

    await import('./main');

    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
  });

  it('keeps dedicated query-provider ownership in main and composes the auth gate outside App', async () => {
    const { AppQueryProvider } = await importRequiredModule<QueryProviderModule>(
      'query/AppQueryProvider.tsx'
    );
    const { AppAuthGate } = await importRequiredModule<AuthGateModule>(
      'features/auth/AppAuthGate.tsx'
    );

    const rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.replaceChildren(rootElement);

    await import('./main');

    expect(renderMock).toHaveBeenCalledTimes(1);

    const renderedTree = renderMock.mock.calls[0]?.[0] as ReactElementLike;
    const { renderedComponentChain, strictModeChild, providerChild, appElement } =
      getMainEntrypointComposition(renderedTree);

    expect(renderedComponentChain.at(0)).toBe('StrictMode');
    expect(strictModeChild?.type).toBe(AppQueryProvider);
    expect(providerChild?.type).toBe(AppAuthGate);
    expect(getRenderedTypeName(appElement?.type)).toBe('MockApp');
  });
});
