import appSource from './App.tsx?raw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type ImportDeclaration,
  type Node,
  type SourceFile,
  ScriptKind,
  ScriptTarget,
  createSourceFile,
  forEachChild,
  isCallExpression,
  isFunctionDeclaration,
  isIdentifier,
  isImportDeclaration,
  isJsxOpeningElement,
  isJsxSelfClosingElement,
  isPropertyAccessExpression,
  isVariableDeclaration,
} from 'typescript';

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));
const quotedStringStartIndex = 1;
const quotedStringEndIndex = -1;
const serviceImportPrefix = './services/';
const providerOrchestrationIdentifiers = new Set([
  'callApi',
  'createAppQueryClient',
  'queryClient',
  'queryKeys',
  'QueryClientProvider',
  'useInfiniteQuery',
  'useMutation',
  'useQueries',
  'useQuery',
  'useSuspenseQuery',
]);
const providerComponentNames = new Set(['AppQueryProvider', 'QueryClientProvider']);
const googleScriptRunPrefix = 'google.script.run';

type QueryProviderModule = {
  AppQueryProvider: (props: { children?: unknown }) => unknown;
};

type AuthGateModule = {
  AppAuthGate: (props: { children?: unknown }) => unknown;
};

type ReactElementLike = {
  type?: unknown;
  props?: {
    children?: unknown;
  };
};

vi.mock('react-dom/client', () => ({
  createRoot: createRootMock,
}));

vi.mock('./App', () => ({
  default: function MockApp() {
    return null;
  },
}));

/**
 * Imports a required module and fails with a clear message if it is missing.
 */
async function importRequiredModule<TModule>(relativePath: string): Promise<TModule> {
  try {
    return (await import(new URL(relativePath, import.meta.url).href)) as TModule;
  } catch (error) {
    throw new Error(`${relativePath} should exist.`, { cause: error });
  }
}

/**
 * Parses a TSX source file from raw source text.
 */
function parseSourceFile(fileName: string, sourceText: string) {
  return createSourceFile(fileName, sourceText, ScriptTarget.Latest, true, ScriptKind.TSX);
}

/**
 * Walks the AST depth-first and invokes the visitor for each node.
 */
function visitNodes(node: Node, visitor: (node: Node) => void) {
  visitor(node);
  forEachChild(node, (child) => {
    visitNodes(child, visitor);
  });
}

/**
 * Returns the module specifiers imported by the source file.
 */
function getImportedModuleSpecifiers(sourceFile: SourceFile) {
  const specifiers: string[] = [];

  visitNodes(sourceFile, (node) => {
    if (isImportDeclaration(node) && node.moduleSpecifier.getText(sourceFile).length > 0) {
      specifiers.push(
        node.moduleSpecifier.getText(sourceFile).slice(quotedStringStartIndex, quotedStringEndIndex)
      );
    }
  });

  return specifiers;
}

/**
 * Returns whether an import declaration contributes runtime bindings.
 */
function hasRuntimeImportBinding(node: Node, sourceFile: SourceFile): node is ImportDeclaration {
  if (!isImportDeclaration(node)) {
    return false;
  }

  const importClauseText = node.importClause?.getText(sourceFile).trim();

  if (!importClauseText) {
    return true;
  }

  return !/^type\b|^\{\s*type\b/u.test(importClauseText);
}

/**
 * Returns the runtime import specifiers used by the source file.
 */
function getRuntimeImportedModuleSpecifiers(sourceFile: SourceFile) {
  const specifiers: string[] = [];

  visitNodes(sourceFile, (node) => {
    if (!hasRuntimeImportBinding(node, sourceFile)) {
      return;
    }

    if (node.moduleSpecifier.getText(sourceFile).length > 0) {
      specifiers.push(
        node.moduleSpecifier.getText(sourceFile).slice(quotedStringStartIndex, quotedStringEndIndex)
      );
    }
  });

  return specifiers;
}

/**
 * Collects hook-like call names made inside the named function component.
 */
function getCalledIdentifiersWithinFunction(sourceFile: SourceFile, functionName: string) {
  const calledIdentifiers = new Set<string>();

  visitNodes(sourceFile, (node) => {
    const isNamedFunction =
      (isFunctionDeclaration(node) && node.name?.text === functionName) ||
      (isVariableDeclaration(node) && node.name.getText(sourceFile) === functionName);

    if (!isNamedFunction) {
      return;
    }

    visitNodes(node, (innerNode) => {
      if (!isCallExpression(innerNode)) {
        return;
      }

      if (isIdentifier(innerNode.expression)) {
        calledIdentifiers.add(innerNode.expression.text);
      }
    });
  });

  return [...calledIdentifiers];
}

/**
 * Collects JSX component names rendered directly within the named function component.
 */
function getRenderedJsxComponentNamesWithinFunction(sourceFile: SourceFile, functionName: string) {
  const componentNames = new Set<string>();

  visitNodes(sourceFile, (node) => {
    const isNamedFunction =
      (isFunctionDeclaration(node) && node.name?.text === functionName) ||
      (isVariableDeclaration(node) && node.name.getText(sourceFile) === functionName);

    if (!isNamedFunction) {
      return;
    }

    visitNodes(node, (innerNode) => {
      if (isJsxOpeningElement(innerNode) || isJsxSelfClosingElement(innerNode)) {
        componentNames.add(innerNode.tagName.getText(sourceFile));
      }
    });
  });

  return [...componentNames];
}

/**
 * Collects property access expressions referenced within the named function component.
 */
function getPropertyAccessesWithinFunction(sourceFile: SourceFile, functionName: string) {
  const propertyAccesses = new Set<string>();

  visitNodes(sourceFile, (node) => {
    const isNamedFunction =
      (isFunctionDeclaration(node) && node.name?.text === functionName) ||
      (isVariableDeclaration(node) && node.name.getText(sourceFile) === functionName);

    if (!isNamedFunction) {
      return;
    }

    visitNodes(node, (innerNode) => {
      if (isPropertyAccessExpression(innerNode)) {
        propertyAccesses.add(innerNode.getText(sourceFile));
      }
    });
  });

  return [...propertyAccesses];
}

/**
 * Returns the only child from a React element props payload.
 */
function getOnlyRenderedChild(children: unknown) {
  if (Array.isArray(children)) {
    return children.find((child) => child !== undefined && child !== null);
  }

  return children;
}

/**
 * Returns a display name for a rendered React element type.
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
 */
function getMainEntrypointComposition(renderedTree: ReactElementLike) {
  const renderedComponentChain = getRenderedComponentChain(renderedTree);
  const strictModeChild = getOnlyRenderedChild(renderedTree.props?.children) as ReactElementLike;
  const authGateElement = getOnlyRenderedChild(strictModeChild?.props?.children) as ReactElementLike;
  const appElement = getOnlyRenderedChild(authGateElement?.props?.children) as ReactElementLike;

  return {
    renderedComponentChain,
    strictModeChild,
    authGateElement,
    appElement,
  };
}

/**
 * Asserts that App stays free of provider and service orchestration.
 */
function expectAppToStayThin() {
  const importedModuleSpecifiers = getAppImportedModuleSpecifiers();
  const runtimeImportedModuleSpecifiers = getAppRuntimeImportedModuleSpecifiers();
  const orchestrationCalls = getAppOrchestrationCalls();
  const providerComponents = getAppProviderComponents();

  expect(importedModuleSpecifiers).not.toContain('@tanstack/react-query');
  expect(
    runtimeImportedModuleSpecifiers.every((specifier) => !specifier.startsWith(serviceImportPrefix))
  ).toBe(true);
  expect(orchestrationCalls).toEqual([]);
  expect(providerComponents).toEqual([]);
  expect(appUsesGoogleScriptRun()).toBe(false);
}

const appSourceFile = parseSourceFile('./App.tsx', appSource);

/**
 * Returns the module specifiers imported by App.
 */
function getAppImportedModuleSpecifiers() {
  return getImportedModuleSpecifiers(appSourceFile);
}

/**
 * Returns the runtime module specifiers imported by App.
 */
function getAppRuntimeImportedModuleSpecifiers() {
  return getRuntimeImportedModuleSpecifiers(appSourceFile);
}

/**
 * Returns provider/service orchestration calls made directly inside App.
 */
function getAppOrchestrationCalls() {
  return getCalledIdentifiersWithinFunction(appSourceFile, 'App').filter((identifier) =>
    providerOrchestrationIdentifiers.has(identifier)
  );
}

/**
 * Returns provider components rendered directly inside App.
 */
function getAppProviderComponents() {
  return getRenderedJsxComponentNamesWithinFunction(appSourceFile, 'App').filter((componentName) =>
    providerComponentNames.has(componentName)
  );
}

/**
 * Returns whether App touches the Google Apps Script runtime directly.
 */
function appUsesGoogleScriptRun() {
  return getPropertyAccessesWithinFunction(appSourceFile, 'App').some(
    (propertyAccess) =>
      propertyAccess === googleScriptRunPrefix ||
      propertyAccess.startsWith(`${googleScriptRunPrefix}.`)
  );
}

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

  it('keeps dedicated query-provider ownership in main while App stays a thin shell', async () => {
    const { AppQueryProvider } = await importRequiredModule<QueryProviderModule>(
      'query/AppQueryProvider.tsx'
    );
    const { AppAuthGate } = await importRequiredModule<AuthGateModule>(
      'features/auth/AppAuthGate.tsx'
    );

    document.body.innerHTML = '<div id="root"></div>';

    await import('./main');

    expect(renderMock).toHaveBeenCalledTimes(1);

    const renderedTree = renderMock.mock.calls[0]?.[0] as ReactElementLike;
    const { renderedComponentChain, strictModeChild, authGateElement, appElement } =
      getMainEntrypointComposition(renderedTree);

    expect(renderedComponentChain.at(0)).toBe('StrictMode');
    expect(strictModeChild?.type).toBe(AppQueryProvider);
    expect(authGateElement?.type).toBe(AppAuthGate);
    expect(getRenderedTypeName(appElement?.type)).toBe('MockApp');
    expectAppToStayThin();
  });
});
