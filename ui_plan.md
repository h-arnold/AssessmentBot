## Plan: Parallel “New UI” with Local‑First Assets

Build a completely new UI alongside the existing Materialize dialogs by adding a separate UI entrypoint (one new modal “app shell”) and vendoring BeerCSS assets into the Apps Script project. For performance and reliability in HTMLService, prefer serving assets from the script itself (inline or included at render time) rather than loading from GitHub at runtime; GitHub hosting adds network latency, caching/MIME quirks, and becomes an availability dependency.

### Steps 1. Create a parallel UI surface (don’t touch legacy)

1. Add a new UI namespace (e.g. a new folder next to [src/AdminSheet/UI](src/AdminSheet/UI)) and a new open method in [src/AdminSheet/UI/UIManager.js](src/AdminSheet/UI/UIManager.js).
2. Expose it via a new menu item (leave existing menu items and dialogs unchanged).

### Steps 2. Use a single “app shell” modal for the new UI

1. Start with one HTML file that becomes the new UI root (routing/state inside the page).
2. Keep all server calls through `google.script.run` as the stable API boundary.

### Steps 3. Vendor BeerCSS locally and include it at render time

1. Store BeerCSS CSS/JS as project files (not remote URLs), so the dialog loads with zero third-party requests.
2. Use BeerCSS “scoped” CSS for safety while you iterate (prevents style bleed if you embed legacy components later).

### Steps 4. Decide how to ship CSS/JS: inline vs “bundled”

1. Prefer “included at render time” (one shared CSS/JS blob injected into the app-shell HTML) over duplicating it in multiple HTML files.
2. Treat “bundle into script” vs “inline in HTML” as mostly equivalent in performance; the real win is “load once” by having a single app-shell modal.

### Steps 5. Handle fonts/icons with an explicit policy

1. If you can tolerate Google-hosted fonts/icons (good track record), keep them as the only external dependency.
2. If you want fully local: plan for either data-URI fonts or an Apps Script-served asset endpoint later.

### Further Considerations 1. Answer to your performance question

1. Hosting CSS on GitHub is usually worse than local for HTMLService: extra request + school network fragility + caching/MIME inconsistencies.
2. The most performant approach here is “single modal + injected local CSS/JS once”, not repeating inline CSS per-dialog.
