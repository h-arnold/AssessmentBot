import appSource from './App.tsx?raw';
import { describe, expect, it } from 'vitest';
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
  expect(isAppUsingGoogleScriptRun()).toBe(false);
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
function isAppUsingGoogleScriptRun() {
  return getPropertyAccessesWithinFunction(appSourceFile, 'App').some(
    (propertyAccess) => {
      return propertyAccess === googleScriptRunPrefix ||
      propertyAccess.startsWith(`${googleScriptRunPrefix}.`);
    }
  );
}

describe('App composition boundary', () => {
  it('keeps App free of provider and service orchestration', () => {
    expectAppToStayThin();
  });
});
