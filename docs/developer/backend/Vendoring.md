# Vendoring third-party assets

## Why we vendor

AssessmentBot avoids runtime third-party CDN dependencies for core UI assets.

This improves:

- **Security**: the deployed script uses committed assets rather than fetching live code at runtime.
- **Availability**: dialogs are not blocked by CDN outages.
- **Reproducibility**: updates are explicit and reviewed via git diffs.

Fonts are currently allowed to use a CDN fallback.

## BeerCSS vendoring

BeerCSS vendoring has been removed. The vendoring script `scripts/vendor-beercss.js` and command `npm run vendor:beercss` are no longer available.

Previously, BeerCSS was installed via npm and vendored into HtmlService partials under `src/AdminSheet/UI/vendor/beercss/`. The existing vendored files remain in place for legacy compatibility.
