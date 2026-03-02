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

This helper evaluates the named file as an HtmlService template and returns the resulting HTML. It uses `HtmlService.createTemplateFromFile(filename).evaluate().getContent()` so any server-side scriptlets in the included file (for example further `<?!= include('...') ?>` calls) are processed before the HTML is injected into the parent template. Because evaluation happens server-side, `include()` is not available to client-side scripts — it simply returns evaluated HTML to the template.

Example usage in a template:

```html
<?!= include('UI/partials/Head') ?>
<?!= include('UI/vendor/beercss/BeerCssScoped') ?> <?!= include('UI/vendor/beercss/BeerCssJs') ?>
```

> Note: If you ever see literal `<?!= include(...) ?>` tags appear in your dialog output, it likely indicates the included file was returned as raw text (not evaluated); using an evaluated include ensures nested scriptlets and imports are handled correctly.

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

It contains the essentials for new BeerCSS-backed HtmlService pages:

- `<base target="_top" />`
- `<meta charset>`
- `<meta name="viewport">`
- Vendored BeerCSS scoped stylesheet
- Vendored BeerCSS JavaScript (for interactive features like field activation, textarea autosize, etc.)

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
2. In `<head>`, include the shared head fragment (which includes BeerCSS):

```html
<?!= include('UI/partials/Head') ?>
```

### Stepper partial & builder (reusable wizard stepper)

A small, reusable stepper builder is provided to make creating multi-step wizards consistent and DRY.

Files:

- `src/AdminSheet/UI/partials/Stepper.html` — server-side partial rendering the initial stepper markup only. Template variables `steps` (array of `{ label }`) and `currentStep` (0-based index) must be set on the parent template before evaluation; `include()` only accepts a filename and does not forward extra arguments.
- `src/AdminSheet/UI/partials/StepperJS.html` — client-side controller script that exposes the `WizardStepper` class in the page scope. Include this separately when you need programmatic control over stepper state at runtime.
- `src/AdminSheet/UI/partials/WizardStepper.js` — the same `WizardStepper` class as a Node-compatible module for use in Vitest unit tests.

Usage patterns:

- Server-rendered initial snapshot (progressive enhancement): set template variables before including the partial:

```javascript
// In the parent template file (server-side scriptlet)
template.steps = [{ label: 'Previous' }, { label: 'Current' }, { label: 'Next' }];
template.currentStep = 1;
```

```html
<?!= include('UI/partials/Stepper') ?>
```

- Client-side behaviour: include `StepperJS` separately to get the `WizardStepper` class, then instantiate it with a DOM container:

```html
<?!= include('UI/partials/StepperJS') ?>
<script>
  // WizardStepper is available in page scope after StepperJS is included
  const stepper = new WizardStepper('#myStepperContainer', {
    steps: [{ label: 'Previous' }, { label: 'Current' }, { label: 'Next' }],
    currentStep: 1,
    onChange: (index) => {
      /* handle step change */
    },
  });
</script>
```

Design notes:

- The client controller is intentionally small and framework-agnostic. It is available as `WizardStepper` in classic-script templates after including `StepperJS.html`.
- `Stepper.html` (markup) and `StepperJS.html` (client script) are separate includes; include both when you need the initial server-rendered snapshot AND runtime updates.
- The controller API includes `setSteps()`, `addStep()`, `removeStep()`, `setCurrent()`, `enableStep()`, and `destroy()`. It emits `onChange` callbacks for user-triggered step changes.
- Accessible markup: the server partial uses `aria-current="step"` for the active step and `aria-disabled="true"` for disabled steps.
- For testing, import from `WizardStepper.js` directly: `const WizardStepper = require('.../WizardStepper.js')`.

This approach follows the project conventions: server-rendered, progressive-enhancement-first, and vendored BeerCSS styling in a `.beer` container.

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

**Vendor-first rule:** Always inspect the vendored BeerCSS partials (`src/AdminSheet/UI/vendor/beercss/BeerCssScoped.html` and `src/AdminSheet/UI/vendor/beercss/BeerCssJs.html`) and the local overrides (`src/AdminSheet/UI/partials/BeerCssOverrides.html`) before making layout or styling changes. Prefer the default BeerCSS classes and patterns (for example `.field.label`, `.suffix`, `.prefix`) over bespoke positioning or overrides — the vendored stylesheet already handles alignment, clipping and icon spacing in most cases.

BeerCSS positions suffix/prefix adornments (including `progress.circle`) using CSS that expects a particular DOM structure.

- For a labelled field, use the BeerCSS `label` helper pattern:
  - `div.field.label ...`
  - input/select first
  - label immediately after (`select + label` is used by BeerCSS CSS/JS)

- For suffix spinners/icons, avoid adding bespoke `position: absolute` rules unless you have to. BeerCSS already centres `progress.circle` in a suffix/prefix field.

### Full-width elements in modals

When an element needs to span the full width of a modal (e.g. a progress bar), using `width: 100%` may not achieve the desired result if the parent container shrinks to fit its content due to flexbox centering.

**Symptom**: A full-width progress bar appears narrower in indeterminate state than in error state, or doesn't span the full modal width.

**Solution**: Use `width: 100vw` (viewport width) on the container to force it to span the full viewport width, rather than relying on percentage-based widths that are relative to a constrained parent.

Example:

```css
body {
  display: flex;
  align-items: center;
  justify-content: center;
}

.full-width-container {
  width: 100vw; /* Forces full viewport width */
}
```

**Note**: This works well for full-screen modals. For dialogs with a fixed width, constrain the container's max-width separately if needed.

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
