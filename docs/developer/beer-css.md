# BeerCSS (vendored) UI scaffolding

## Overview

AssessmentBot is moving towards **vendored UI styling** for new dialogs and wizards to reduce external dependencies (and the security/availability risks that come with runtime CDN loads).

BeerCSS is used as the default CSS provider for new UI surfaces. Existing Materialize-based dialogs remain in place for backwards compatibility.

Key goals:

- No runtime CDN dependencies for CSS/JS/fonts
- A minimal, predictable UI baseline for dialogs
- Low blast-radius styling changes (scoped CSS)

## What was implemented

### 1) Template includes for HtmlService

Google Apps Script HtmlService templates can include other files using server-side scriptlets.

A global helper was added:

- `include(filename)` in src/AdminSheet/zz_main.js

This returns the contents of a project HTML file so templates can do:

```html
<?!= include('UI/partials/Head') ?>
<?!= include('UI/vendor/beercss/BeerCssScoped') ?>
```

This makes it easy to share a single vendored stylesheet across multiple new dialogs.

### 2) Vendored BeerCSS (scoped)

BeerCSS is vendored as an HtmlService partial which injects the CSS via a `<style>` block:

- src/AdminSheet/UI/vendor/beercss/BeerCssScoped.html

The file contains a short header comment recording:

- The upstream commit SHA
- The raw source URL
- The download date

The BeerCSS licence text is stored alongside it:

- src/AdminSheet/UI/vendor/beercss/LICENCE_BeerCSS.txt

Why **scoped**?

BeerCSS provides a scoped build intended to apply only within an element that has the `beer` class. This keeps styling contained to the new UI and avoids unintended interactions with legacy dialogs.

### 3) Shared head fragment

A tiny, dependency-free head fragment was added:

- src/AdminSheet/UI/partials/Head.html

It contains only the essentials for HtmlService pages:

- `<base target="_top" />`
- `<meta charset>`
- `<meta name="viewport">`

### 4) Demo dialog scaffold

A minimal dialog exists as a reference implementation:

- src/AdminSheet/UI/BeerCssDemoDialog.html

It is opened by:

- `UIManager.showBeerCssDemoDialog()` in src/AdminSheet/UI/UIManager.js
- `showBeerCssDemoDialog()` global function in src/AdminSheet/zz_main.js

This dialog is intentionally basic: it exists to prove the include/vendoring path works end-to-end.

## How to build a new BeerCSS-backed dialog

1. Create a new HtmlService template under `src/AdminSheet/UI/`.
2. In `<head>`, include the shared head fragment and BeerCSS:

```html
<?!= include('UI/partials/Head') ?>
<?!= include('UI/vendor/beercss/BeerCssScoped') ?>
```

3. In `<body>`, wrap your content in a scoped container:

```html
<div class="beer">
  <!-- Your dialog content -->
</div>
```

4. Open the dialog using `HtmlService.createTemplateFromFile(...)` (not `createHtmlOutputFromFile(...)`), so that `<?!= ... ?>` scriptlets are evaluated.

The existing `UIManager._showTemplateDialog(...)` helper already follows this pattern.

## Updating BeerCSS

When you need to bump BeerCSS:

1. Pick an upstream tag/commit to pin to.
2. Replace the contents of `src/AdminSheet/UI/vendor/beercss/BeerCssScoped.html` with the updated `beer.scoped.min.css` (still wrapped in `<style>`).
3. Update the header comment (SHA, URL, date).
4. Check whether the upstream licence text changed and update `LICENCE_BeerCSS.txt` if required.
5. Run `npm test`.

## Notes / constraints (Apps Script HtmlService)

- HtmlService dialogs are sandboxed; the simplest and most reliable way to avoid external dependencies is to embed CSS/JS directly into the HTML output.
- If you add any optional BeerCSS JavaScript in future, vendor it similarly as an HtmlService partial (e.g. a `<script>` block) and include it only where it is needed.
