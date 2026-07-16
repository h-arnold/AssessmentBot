// Playwright's test-worker transform (Babel) cannot parse CSS-module imports that appear
// transitively in imported source modules. E2E runs against the Vite dev server, which serves
// real CSS, so stub any .css import as an empty ES module during the Playwright test run.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.css')) {
    return {
      url: 'data:text/javascript,export default {};',
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) {
    return { format: 'module', source: 'export default {};', shortCircuit: true };
  }
  // Node 24 ESM requires importAttributes: { type: 'json' } for JSON modules.
  // Playwright normally injects this, but when a custom loader is in the chain,
  // the attribute is absent. Restore it here to prevent ERR_IMPORT_ATTRIBUTE_MISSING.
  if (url.endsWith('.json')) {
    return nextLoad(url, {
      ...context,
      format: 'json',
      importAttributes: { type: 'json' },
    });
  }
  return nextLoad(url, context);
}
