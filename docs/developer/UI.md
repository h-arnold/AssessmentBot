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

- `include(filename)` in [src/AdminSheet/UI/globals.js](../../src/AdminSheet/UI/globals.js)

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

- `BeerCSSUIHandler.showBeerCssDemoDialog()` in [src/AdminSheet/UI/99_BeerCssUIHandler.js](../../src/AdminSheet/UI/99_BeerCssUIHandler.js)
- Global function delegation in [src/AdminSheet/UI/globals.js](../../src/AdminSheet/UI/globals.js)

This dialog is intentionally basic: it exists to prove the include/vendoring path works end-to-end.

### 5) BeerCSS Playground

An interactive component preview dialog is also available:

- src/AdminSheet/UI/BeerCssPlayground.html

It is opened by:

- `BeerCSSUIHandler.showBeerCssPlaygroundDialog()` in [src/AdminSheet/UI/handlers/BeerCSSUIHandler.js](../../src/AdminSheet/UI/handlers/BeerCSSUIHandler.js)
- Global function delegation in [src/AdminSheet/UI/globals.js](../../src/AdminSheet/UI/globals.js)

The playground showcases a wider range of BeerCSS components (buttons, inputs, chips, badges, etc.) and serves as a helpful reference for developers building new dialogs.

### 6) UI Handler Architecture

To support gradual migration from legacy Materialize-based UI to BeerCSS, a handler-based architecture was implemented:

**[BeerCSSUIHandler](../../src/AdminSheet/UI/handlers/BeerCSSUIHandler.js)** extends `UIManager` and serves as the new UI layer. Key features:

- **Inheritance**: Automatically inherits all UI infrastructure from `UIManager` (`this.ui`, `safeUiOperation()`, etc.)
- **Gradual migration**: As features are refactored, methods are overridden in `BeerCSSUIHandler` with BeerCSS implementations
- **Backward compatibility**: Unrefactored features fall back to legacy implementations in the parent `UIManager` class
- **New helper**: Provides `_renderBeerCSSDialog()` for consistent BeerCSS template rendering
- **Final simplification**: Once all features are migrated, `BeerCSSUIHandler` will be renamed to `UIManager` and the old class removed

All global UI functions in [globals.js](../../src/AdminSheet/UI/globals.js) route through `BeerCSSUIHandler.getInstance()`, ensuring new code paths are used while legacy implementations remain available.

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

4. Add a method to [BeerCSSUIHandler](../../src/AdminSheet/UI/handlers/BeerCSSUIHandler.js) using the `_renderBeerCSSDialog()` helper:

```javascript
showMyNewDialog() {
  this._renderBeerCSSDialog('UI/MyNewDialog', { data: 'values' }, 'Dialog Title', {
    width: 500,
    height: 400,
  });
}
```

5. When refactoring an existing UIManager method, override it in `BeerCSSUIHandler` with your BeerCSS implementation. The parent class remains unchanged for reference.

## Updating BeerCSS

When you need to bump BeerCSS:

1. Pick an upstream tag/commit to pin to.
2. Replace the contents of `src/AdminSheet/UI/vendor/beercss/BeerCssScoped.html` with the updated `beer.scoped.min.css` (still wrapped in `<style>`).
3. Update the header comment (SHA, URL, date).
4. Check whether the upstream licence text changed and update `LICENCE_BeerCSS.txt` if required.
5. Run `npm test` to verify all UI tests still pass.

## Notes / constraints (Apps Script HtmlService)

- HtmlService dialogs are sandboxed; the simplest and most reliable way to avoid external dependencies is to embed CSS/JS directly into the HTML output.
- If you add any optional BeerCSS JavaScript in future, vendor it similarly as an HtmlService partial (e.g. a `<script>` block) and include it only where it is needed.

## Refactoring workflow

When migrating an existing UIManager method to BeerCSS:

1. Create or update the template file under `src/AdminSheet/UI/`
2. Add or override the method in [BeerCSSUIHandler](../../src/AdminSheet/UI/handlers/BeerCSSUIHandler.js)
3. Use `_renderBeerCSSDialog()` helper to display it
4. Test the new implementation
5. Delete the old method from [UIManager.js](../../src/AdminSheet/UI/UIManager.js) once migration is complete
6. Once all features are migrated, rename `BeerCSSUIHandler` to `UIManager` and remove the old class
