import appSource from './App.tsx?raw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type ImportDeclaration,
  type NamedImportBindings,
  type Node,
  type SourceFile,
  ScriptKind,
  SyntaxKind,
  ScriptTarget,
  createSourceFile,
  forEachChild,
  isCallExpression,
  isFunctionDeclaration,
  isIdentifier,
  isImportDeclaration,
  isJsxOpeningElement,
  isJsxSelfClosingElement,
  isNamedImports,
  isNamespaceImport,
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
  AppQueryProvider: (properties: { children?: unknown }) => unknown;
};

type AuthGateModule = {
  AppAuthGate: (properties: { children?: unknown }) => unknown;
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
 * Parses a TSX source file from raw source text.
 *
 * @param {string} fileName - The synthetic file name to associate with the source.
 * @param {string} sourceText - The TSX source text to parse.
 * @returns {SourceFile} The parsed source file.
 */
function parseSourceFile(fileName: string, sourceText: string) {
  return createSourceFile(fileName, sourceText, ScriptTarget.Latest, true, ScriptKind.TSX);
}

/**
 * Walks the AST depth-first and invokes the visitor for each node.
 *
 * @param {Node} node - The current AST node.
 * @param {(node: Node) => void} visitor - The visitor callback to invoke for each node.
 */
function visitNodes(node: Node, visitor: (node: Node) => void) {
  visitor(node);
  forEachChild(node, (child) => {
    visitNodes(child, visitor);
  });
}

/**
 * Returns the module specifiers imported by the source file.
 *
 * @param {SourceFile} sourceFile - The source file to inspect.
 * @returns {string[]} The module specifiers imported by the file.
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
 *
 * @param {Node} node - The node to inspect.
 * @returns {boolean} Whether the import contributes runtime bindings.
 */
function hasRuntimeImportBinding(node: Node): node is ImportDeclaration {
  if (!isImportDeclaration(node)) {
    return false;
  }

  const importClause = node.importClause;

  if (!importClause) {
    return true; // Bare import like `import 'module'` has runtime effect
  }

  // `phaseModifier` is the TypeScript 5.x+ replacement for the deprecated `isTypeOnly` flag.
  // If the entire import is type-only (e.g., `import type { Foo, Bar }`)
  if (importClause.phaseModifier === SyntaxKind.TypeKeyword) {
    return false;
  }

  // Default import always has runtime binding (e.g., `import React from 'react'`)
  if (importClause.name) {
    return true;
  }

  return hasRuntimeNamedBindings(importClause.namedBindings);
}

/**
 * Returns whether named import bindings contribute runtime bindings.
 *
 * @param {NamedImportBindings | undefined} namedBindings - The named import bindings to inspect.
 * @returns {boolean} Whether the bindings contribute runtime bindings.
 */
function hasRuntimeNamedBindings(namedBindings: NamedImportBindings | undefined) {
  if (!namedBindings) {
    return false;
  }

  // Namespace import always has runtime binding (e.g., `import * as Foo from 'module'`)
  if (isNamespaceImport(namedBindings)) {
    return true;
  }

  // Named bindings: return true if ANY specifier is NOT type-only
  if (isNamedImports(namedBindings)) {
    return namedBindings.elements.some((element) => !element.isTypeOnly);
  }

  return true; // Conservative default
}

/**
 * Returns the runtime import specifiers used by the source file.
 *
 * @param {SourceFile} sourceFile - The source file to inspect.
 * @returns {string[]} The runtime import specifiers used by the file.
 */
function getRuntimeImportedModuleSpecifiers(sourceFile: SourceFile) {
  const specifiers: string[] = [];

  visitNodes(sourceFile, (node) => {
    if (!hasRuntimeImportBinding(node)) {
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
 *
 * @param {SourceFile} sourceFile - The source file to inspect.
 * @param {string} functionName - The function name to search within.
 * @returns {string[]} The called identifier names.
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
 *
 * @param {SourceFile} sourceFile - The source file to inspect.
 * @param {string} functionName - The function name to search within.
 * @returns {string[]} The rendered JSX component names.
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
 *
 * @param {SourceFile} sourceFile - The source file to inspect.
 * @param {string} functionName - The function name to search within.
 * @returns {string[]} The property access expressions.
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

/**
 * Asserts that App stays free of provider and service orchestration.
 *
 * @returns {void} Nothing.
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
 *
 * @returns {string[]} The imported module specifiers.
 */
function getAppImportedModuleSpecifiers() {
  return getImportedModuleSpecifiers(appSourceFile);
}

/**
 * Returns the runtime module specifiers imported by App.
 *
 * @returns {string[]} The runtime module specifiers.
 */
function getAppRuntimeImportedModuleSpecifiers() {
  return getRuntimeImportedModuleSpecifiers(appSourceFile);
}

/**
 * Returns provider/service orchestration calls made directly inside App.
 *
 * @returns {string[]} The orchestration call names.
 */
function getAppOrchestrationCalls() {
  return getCalledIdentifiersWithinFunction(appSourceFile, 'App').filter((identifier) =>
    providerOrchestrationIdentifiers.has(identifier)
  );
}

/**
 * Returns provider components rendered directly inside App.
 *
 * @returns {string[]} The rendered provider component names.
 */
function getAppProviderComponents() {
  return getRenderedJsxComponentNamesWithinFunction(appSourceFile, 'App').filter((componentName) =>
    providerComponentNames.has(componentName)
  );
}

/**
 * Returns whether App touches the Google Apps Script runtime directly.
 *
 * @returns {boolean} Whether App touches the Google Apps Script runtime directly.
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

  it('keeps dedicated query-provider ownership in main and composes the auth gate outside App', async () => {
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
    const { renderedComponentChain, strictModeChild, providerChild, appElement } =
      getMainEntrypointComposition(renderedTree);

    expect(renderedComponentChain.at(0)).toBe('StrictMode');
    expect(strictModeChild?.type).toBe(AppQueryProvider);
    expect(providerChild?.type).toBe(AppAuthGate);
    expect(getRenderedTypeName(appElement?.type)).toBe('MockApp');
    expectAppToStayThin();
  });
});
