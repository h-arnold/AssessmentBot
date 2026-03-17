# Security linter findings

## Baseline before hardening

- Backend lint: 1 error, 193 warnings.
- Frontend lint: 2 errors, 9 warnings.
- Builder lint: 0 errors, 108 warnings.

## Triage batches

### Batch 1: shared severity promotion

- Promoted shared `eslint-plugin-security` recommended rules from warning to error in `config/eslint/ts-base-rules.cjs`.
- Promoted shared Unicode hardening rules from warning to error in `config/eslint/unicode-security-rules.cjs`.

### Batch 2: actionable code fixes

- Builder HTML transform now avoids dynamic `RegExp` construction when reading and removing HTML attributes.
- Backend validation helpers now use Unicode regex flags where safe.
- Backend utility helpers received small targeted fixes for timing-attack and dynamic array-index lint findings.
- Frontend shell rendering now uses explicit renderer selection rather than dynamic keyed access.
- Frontend test AST helper now avoids deprecated TypeScript APIs and the stale unused parameter.
- Removed the stale `import/no-dynamic-require` disable from `tests/backend-api/abclassPartials.unit.test.js`.

### Batch 3: confirmed false positives / intentional scoped suppressions

- Root backend tests: `require-unicode-regexp` disabled for `tests/**/*.js` because many tests intentionally use literal regex fixtures and this was triaged as non-actionable noise.
- Root backend runtime: `security/detect-object-injection` disabled only for an explicit list of backend files that rely on safe keyed-access patterns already guarded by domain logic.
- Frontend tests: `require-unicode-regexp` and `security/detect-object-injection` disabled only for `src/**/*.{spec,test}.{ts,tsx}` as documented test-only false positives.
- Builder runtime: `security/detect-non-literal-fs-filename` disabled in builder lint because builder path resolution is already constrained to repo-root-safe paths by design.
- Builder runtime/tests: `security/detect-object-injection` disabled only for explicit builder files still producing false positives after triage.
- Backend regex constants in `src/backend/ConfigurationManager/03_validators.js` and `src/backend/Utils/Validate.js` retain narrow inline `security/detect-unsafe-regex` suppressions where anchored, bounded patterns were still flagged incorrectly.

## Actionable vs false-positive summary

### Actionable items fixed

- Dynamic regex construction in builder transform.
- Missing Unicode regex flags in selected backend source files.
- Timing-attack comparison warning in backend utilities.
- Dynamic renderer access in frontend shell.
- Frontend spec lint errors.
- Stale lint-rule disable in backend tests.

### False positives intentionally scoped

- Test-only Unicode regex warnings.
- Safe keyed-access object-injection warnings in selected backend and builder files.
- Builder non-literal filesystem filename warnings where repo-root path safety is the enforced design.
- Two anchored backend validation regexes still flagged by `detect-unsafe-regex`.

## Result

After the config and code changes above, the targeted lint commands are expected to run clean:

```bash
npm run lint && npm run frontend:lint && npm run builder:lint
```
