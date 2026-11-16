# Vendoring third-party assets

## Why we vendor

AssessmentBot avoids runtime third-party CDN dependencies. The deployed script ships committed
assets rather than fetching live code at runtime. This improves:

- **Security**: the reviewed code is the code that runs.
- **Availability**: no feature depends on a third-party CDN being reachable.
- **Reproducibility**: updates are explicit and reviewed through git diffs.

## Vendored assets

The only vendored runtime asset is the JsonDbApp snapshot at
`scripts/builder/vendor/jsondbapp`. Its `appsscript.json` and `src/` tree are committed together.

The builder validates and inlines that snapshot; it never downloads it. See
[Builder Script § Stage 6–8](../builder/builder-script.md#stage-6-resolve-jsondb-source) for the validation,
namespace-wrapping and manifest-merge steps.

To update the snapshot, replace the committed directory with the new upstream release, then run the
build. Stage 6 rejects missing manifests, missing configured source files and placeholder content
before the bundle is written.

The frontend build must not depend on external assets either: Stage 4 inlines local stylesheets and
module scripts and fails on any unresolved external reference.
