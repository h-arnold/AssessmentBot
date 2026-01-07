# BeerCSS (vendored) UI scaffolding

## Overview

AssessmentBot is moving towards **vendored UI styling** for new dialogs and wizards to reduce external dependencies (and the security/availability risks that come with runtime CDN loads).

BeerCSS is used as the default CSS provider for new UI surfaces. Existing Materialize-based dialogs remain in place for backwards compatibility.

Key goals:

- No runtime CDN dependencies for core CSS/JS (vendored into HtmlService templates)
- A minimal, predictable UI baseline for dialogs
- Low blast-radius styling changes (scoped CSS)

Notes:

- The current BeerCSS scoped stylesheet includes a CDN fallback for Material Symbols font files. This is an accepted trade-off (fonts may be remote).

## What was implemented

### 1) Template includes for HtmlService

Google Apps Script HtmlService templates can include other files using server-side scriptlets.

A global helper was added:

- `include(filename)` in [src/AdminSheet/UI/97_globals.js](../../src/AdminSheet/UI/97_globals.js)

This returns the contents of a project HTML file so templates can do:

```html
<?!= include('UI/partials/Head') ?>
<?!= include('UI/vendor/beercss/BeerCssScoped') ?> <?!= include('UI/vendor/beercss/BeerCssJs') ?>
```

This makes it easy to share a single vendored stylesheet across multiple new dialogs.

### 2) Vendored BeerCSS (scoped)

BeerCSS is vendored as an HtmlService partial which injects the CSS via a `<style>` block:

- src/AdminSheet/UI/vendor/beercss/BeerCssScoped.html

### 2b) Vendored BeerCSS JavaScript

BeerCSS JavaScript is vendored as an HtmlService partial which injects the JS via a `<script>` block:

- src/AdminSheet/UI/vendor/beercss/BeerCssJs.html

Why is this required?

- BeerCSS provides helpful client-side behaviour (field activation, `[data-ui]` triggers, textarea autosize, etc.).
- The upstream `beer.min.js` distribution is ESM and ends with `export ...`, which is not compatible with Apps Script HtmlService classic scripts.
- The vendored JS is made GAS-compatible by stripping ESM export statements while leaving runtime behaviour unchanged.

Each generated partial has a header comment with the source path, the npm version, an ISO timestamp, and (for the JS) a note that the ESM export was stripped.

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
- Global function delegation in [src/AdminSheet/UI/97_globals.js](../../src/AdminSheet/UI/97_globals.js)

This dialog is intentionally basic: it exists to prove the include/vendoring path works end-to-end.

### 5) BeerCSS Playground

An interactive component preview dialog is also available:

- src/AdminSheet/UI/BeerCssPlayground.html

It is opened by:

- `BeerCSSUIHandler.showBeerCssPlaygroundDialog()` in [src/AdminSheet/UI/99_BeerCssUIHandler.js](../../src/AdminSheet/UI/99_BeerCssUIHandler.js)
- Global function delegation in [src/AdminSheet/UI/97_globals.js](../../src/AdminSheet/UI/97_globals.js)

The playground showcases a wider range of BeerCSS components (buttons, inputs, chips, badges, etc.) and serves as a helpful reference for developers building new dialogs.

### 6) UI Handler Architecture

To support gradual migration from legacy Materialize-based UI to BeerCSS, a handler-based architecture was implemented:

**[BeerCSSUIHandler](../../src/AdminSheet/UI/99_BeerCssUIHandler.js)** extends `UIManager` and serves as the new UI layer. Key features:

- **Inheritance**: Automatically inherits all UI infrastructure from `UIManager` (`this.ui`, `safeUiOperation()`, etc.)
- **Gradual migration**: As features are refactored, methods are overridden in `BeerCSSUIHandler` with BeerCSS implementations
- **Backward compatibility**: Unrefactored features fall back to legacy implementations in the parent `UIManager` class
- **New helper**: Provides `_renderBeerCSSDialog()` for consistent BeerCSS template rendering
- **Final simplification**: Once all features are migrated, `BeerCSSUIHandler` will be renamed to `UIManager` and the old class removed

Global functions that call `getUIManager()` in [97_globals.js](../../src/AdminSheet/UI/97_globals.js) use `BeerCSSUIHandler` (e.g. `openReferenceSlideModal`, `showClassroomDropdown`), while legacy modals (`showProgressModal`, `showConfigurationDialog`, `showAssignmentDropdown`, and the classroom editor helpers) still call `UIManager.getInstance()`. `BeerCSSUIHandler` currently overrides the BeerCSS demo, playground, and assignment definition dialogs; `showAssignmentDefinitionDialog` falls back to sample data when no definition is provided.

## How to build a new BeerCSS-backed dialog

1. Create a new HtmlService template under `src/AdminSheet/UI/`.
2. In `<head>`, include the shared head fragment and BeerCSS:

```html
<?!= include('UI/partials/Head') ?>
<?!= include('UI/vendor/beercss/BeerCssScoped') ?> <?!= include('UI/vendor/beercss/BeerCssJs') ?>
```

3. In `<body>`, wrap your content in a scoped container:

```html
<div class="beer">
  <!-- Your dialog content -->
</div>
```

4. Add a method to [BeerCSSUIHandler](../../src/AdminSheet/UI/99_BeerCssUIHandler.js) using the `_renderBeerCSSDialog()` helper:

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

1. Update the npm dependency (pin to an explicit version):

```bash
npm install beercss@<version>
```

2. Regenerate the vendored partials:

```bash
npm run vendor:beercss
```

This updates:

- `src/AdminSheet/UI/vendor/beercss/BeerCssScoped.html`
- `src/AdminSheet/UI/vendor/beercss/BeerCssJs.html`

3. Check whether the upstream licence text changed and update `src/AdminSheet/UI/vendor/beercss/LICENCE_BeerCSS.txt` if required.
4. Run `npm test` to verify UI tests still pass.

## Notes / constraints (Apps Script HtmlService)

- HtmlService dialogs are sandboxed; the simplest and most reliable way to avoid external dependencies is to embed CSS/JS directly into the HTML output.
- BeerCSS JS is optional per-dialog. Include `UI/vendor/beercss/BeerCssJs` only in dialogs that need the interactive behaviour.

## Styling tips and pitfalls (BeerCSS + HtmlService)

These notes are based on real behaviour observed while building the assessment wizard Step 1.

### Apps Script modal title (dialog chrome)

- Avoid an empty title string in `ui.showModalDialog(html, title)`. In some contexts the dialog may fail to render (the script “runs” but no modal appears).
- If the dialog already contains a clear heading, you can still use a short title for the chrome (e.g. `Step 1 - Select assignment`) and remove the redundant heading from the HTML.

### Avoid accidental scrollbars

HtmlService pages often pick up default browser margins, which can introduce a vertical scrollbar inside the modal.

- Prefer setting `html, body { margin: 0; padding: 0; }`.
- When you have a footer, use a simple flex column layout (`body { display: flex; flex-direction: column; }`) so the footer does not create unexpected overflow.
- Keep the dialog height tight to the actual content; oversized dialogs are more likely to show scrollbars in Google’s iframe wrapper.

### BeerCSS field structure matters (labels, suffix/prefix)

BeerCSS positions suffix/prefix adornments (including `progress.circle`) using CSS that expects a particular DOM structure.

- For a labelled field, use the BeerCSS `label` helper pattern:
  - `div.field.label ...`
  - input/select first
  - label immediately after (`select + label` is used by BeerCSS CSS/JS)

- For suffix spinners/icons, avoid adding bespoke `position: absolute` rules unless you have to. BeerCSS already centres `progress.circle` in a suffix/prefix field.

### Accessibility and lint rules

- For inline status messaging, prefer an `<output>` element rather than `role="status"` on a generic element.
- Prefer `globalThis` over `window` when exposing values for test hooks.

### Visual consistency (fonts)

- BeerCSS applies its own typography; it will not exactly match Google Sheets’ UI font stack.
- If matching Sheets becomes a hard requirement, do it explicitly and scoped (within the `.beer` container), otherwise accept the slight difference as the standard for BeerCSS-backed dialogs.

## Refactoring workflow

When migrating an existing UIManager method to BeerCSS:

1. Create or update the template file under `src/AdminSheet/UI/`
2. Add or override the method in [BeerCSSUIHandler](../../src/AdminSheet/UI/99_BeerCssUIHandler.js)
3. Use `_renderBeerCSSDialog()` helper to display it
4. Test the new implementation
5. Delete the old method from [98_UIManager.js](../../src/AdminSheet/UI/98_UIManager.js) once migration is complete
6. Once all features are migrated, rename `BeerCSSUIHandler` to `UIManager` and remove the old class
