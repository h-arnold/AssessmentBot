# Vendoring third-party assets

## Why we vendor

AssessmentBot avoids runtime third-party CDN dependencies for core UI assets.

This improves:

- **Security**: the deployed script uses committed assets rather than fetching live code at runtime.
- **Availability**: dialogs are not blocked by CDN outages.
- **Reproducibility**: updates are explicit and reviewed via git diffs.

Fonts are currently allowed to use a CDN fallback (see BeerCSS scoped CSS).

## BeerCSS vendoring (npm)

BeerCSS is installed via npm and vendored into HtmlService partials under `src/AdminSheet/UI/vendor/beercss/`.

### Commands

Install or update BeerCSS:

```bash
npm install beercss@<version>
```

Regenerate the vendored partials:

```bash
npm run vendor:beercss
```

### What gets generated

The vendoring script is `scripts/vendor-beercss.js`.

It regenerates:

- `src/AdminSheet/UI/vendor/beercss/BeerCssScoped.html` (scoped BeerCSS CSS wrapped in a `<style>` block)
- `src/AdminSheet/UI/vendor/beercss/BeerCssJs.html` (BeerCSS JS wrapped in a `<script>` block)

### Why the JS is transformed

The upstream `beercss/dist/cdn/beer.min.js` output is ESM and ends with an `export ...` statement.

Apps Script HtmlService templates execute scripts as classic scripts, so ESM export syntax causes a runtime syntax error.

The vendoring script strips trailing ESM export statements to produce a classic-script compatible build.

If BeerCSS ever introduces ESM `import` statements into its CDN build, the vendoring script will fail fast and bundling will be required.

### After updating

Always run:

```bash
npm test
```

…and review the diffs to the vendored assets before committing.
