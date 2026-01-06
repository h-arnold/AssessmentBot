const fs = require('node:fs');
const path = require('node:path');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith('\n') ? content : content + '\n', 'utf8');
}

function stripEsmExports(js) {
  const hasImport = /\bimport\b/.test(js);
  if (hasImport) {
    throw new Error('BeerCSS JS appears to contain ESM imports; bundling would be required.');
  }

  let stripped = js;

  // Remove trailing named export (most common in BeerCSS dist/cdn output).
  stripped = stripped.replace(/\s*export\s*\{[\s\S]*?\}\s*;?\s*$/, '');

  // Remove trailing default export if present.
  stripped = stripped.replace(/\s*export\s+default[\s\S]*?;?\s*$/, '');

  const stillHasExport = /\bexport\b/.test(stripped);
  if (stillHasExport) {
    throw new Error(
      'BeerCSS JS still contains an export statement after stripping; bundling would be required.'
    );
  }

  return stripped;
}

function buildHeader({ title, source, version, notes }) {
  const updatedIso = new Date().toISOString();
  const lines = [
    '<!--',
    `  ${title}`,
    `  Source: ${source}`,
    `  Version: beercss@${version}`,
    `  Updated: ${updatedIso}`,
  ];

  if (notes) {
    lines.push(`  Notes: ${notes}`);
  }

  lines.push('-->');
  return lines.join('\n');
}

function vendorBeerCss() {
  const repoRoot = path.resolve(__dirname, '..');
  const beercssDir = path.join(repoRoot, 'node_modules', 'beercss');
  const beercssPkgPath = path.join(beercssDir, 'package.json');

  if (!fs.existsSync(beercssPkgPath)) {
    throw new Error(
      "BeerCSS is not installed. Run 'npm install' (or 'npm install beercss') before vendoring."
    );
  }

  const beercssPkg = JSON.parse(readText(beercssPkgPath));
  const version = beercssPkg.version;

  const cssSource = path.join(beercssDir, 'dist', 'cdn', 'beer.scoped.min.css');
  const jsSource = path.join(beercssDir, 'dist', 'cdn', 'beer.min.js');

  const cssOut = path.join(
    repoRoot,
    'src',
    'AdminSheet',
    'UI',
    'vendor',
    'beercss',
    'BeerCssScoped.html'
  );

  const jsOut = path.join(
    repoRoot,
    'src',
    'AdminSheet',
    'UI',
    'vendor',
    'beercss',
    'BeerCssJs.html'
  );

  const css = readText(cssSource);
  const js = readText(jsSource);
  const jsClassic = stripEsmExports(js);

  const cssHeader = buildHeader({
    title: 'BeerCSS (scoped) vendored for Apps Script HtmlService',
    source: 'node_modules/beercss/dist/cdn/beer.scoped.min.css',
    version,
  });

  const jsHeader = buildHeader({
    title: 'BeerCSS JavaScript vendored for Apps Script HtmlService',
    source: 'node_modules/beercss/dist/cdn/beer.min.js',
    version,
    notes: 'Strips ESM export so it can run as a classic script in GAS HtmlService.',
  });

  writeText(cssOut, `${cssHeader}\n<style>\n${css}\n</style>`);
  writeText(jsOut, `${jsHeader}\n<script>\n${jsClassic}\n</script>`);
}

if (require.main === module) {
  try {
    vendorBeerCss();
    process.stdout.write('BeerCSS assets vendored successfully.\n');
  } catch (err) {
    console.error('Failed to vendor BeerCSS assets:', err);
    process.exit(1);
  }
}

module.exports = { stripEsmExports, vendorBeerCss };
