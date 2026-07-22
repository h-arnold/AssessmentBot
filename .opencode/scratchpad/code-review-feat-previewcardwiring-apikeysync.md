# Pre-PR Code Review — `feat/PreviewCardWiring`

**Scope:** Backend data-shape / schema consistency, focused on the API-key token validation
contract in `src/backend/ConfigurationManager/03_validators.js` and its mirror in the frontend
`backendConfigurationValidation.ts`. Branch compared against `main` via `git diff main...HEAD`.

**Constraint note:** Per the review instructions, lint/type-check/tests were NOT executed. Findings
below are derived from source/diff reading and cross-runtime comparison only.

---

## Summary

**Verdict: Needs Improvement** (non-blocking). The core API-key contract — the regex and the
user-facing error message — is byte-for-byte identical across both runtimes, so the two runtimes
**agree** on acceptance. However, there are documentation-drift and normalisation-consistency items
that should be resolved before merge.

---

## DIFF FINDINGS

### D1 — (Verification, no defect) API-key regex and message are in sync across runtimes — PASS

- **Backend:** `src/backend/ConfigurationManager/03_validators.js:9`
  `const API_KEY_PATTERN = /^[A-Za-z0-9]+_[A-Za-z0-9_-]{32}$/u;`
- **Frontend:** `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts:7`
  `const backendApiKeyTokenRegex = /^[A-Za-z0-9]+_[A-Za-z0-9_-]{32}$/u;`
- **Message (identical):** `03_validators.js:51` and `backendConfigurationValidation.ts:10-11` both
  read `'API Key must be an alphanumeric prefix followed by an underscore and exactly 32 base64url
characters (A-Z, a-z, 0-9, hyphen, underscore).'`
- **Cross-check:** The regex is consumed in exactly one place per runtime — backend
  `validateApiKey` (`03_validators.js:48`) and `isValidApiKey`
  (`98_ConfigurationManagerClass.js:304-307`); frontend `isBackendApiKeyToken`
  (`backendConfigurationValidation.ts:19`) which is reused by `BackendApiKeyWriteSchema`
  (`backendConfiguration.zod.ts:12-17`) and `BackendSettingsFormSchema`
  (`backendSettingsForm.zod.ts:74`). No third, divergent definition exists.
- **Conclusion:** The deliberate "keep both in sync" contract holds. No action required.

### D2 — Improvement: `validateApiKey` validates the trimmed value but stores/returns the untrimmed original

- **Severity:** Improvement (low)
- **File:line:** `src/backend/ConfigurationManager/03_validators.js:48-54`
  ```javascript
  function validateApiKey(value) {
    if (!Validate.isNonEmptyString(value) || !API_KEY_PATTERN.test(value.trim())) {
      throw new Error(...);
    }
    return value;            // <-- returns the ORIGINAL, untrimmed value
  }
  ```
- **Inconsistency:** Validation is performed on `value.trim()`, but the function returns the
  untrimmed `value`. Consequently `setApiKey`/`setProperty` will **persist a whitespace-padded key**
  if any caller supplies one (the frontend transport trims via Zod `.trim()`, but a direct/SDK
  caller, or any future path that does not pre-trim, would persist padding that the frontend's
  trimmed read/validation contract would later reject). This is a data-shape inconsistency between
  what is validated and what is stored.
- **Fix:** Normalise on store to match the validated shape: `return value.trim();` (the frontend
  already sends a trimmed key, so this is behaviour-preserving for the real writer) — or,
  alternatively, validate `value` directly without trimming so the accepted and stored shapes are
  identical. Prefer `return value.trim();`.

### D3 — Improvement: Backend API-key tests do not mirror the frontend boundary cases

- **Severity:** Improvement (low)
- **File:line:** `tests/configurationManager/configurationManager.test.js:126-152` and
  `:725-729` (`isValidApiKey`).
- **Inconsistency:** The frontend suite `backendConfigurationValidation.spec.ts` exercises the
  exact contract boundaries — 31-char token (rejected), 33-char token (rejected), illegal `+`
  character (rejected), missing underscore (rejected), leading hyphen (rejected). The backend suite
  only checks one valid sample (`abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1`), an invalid slug
  (`invalid-key-`), and a non-string (`123`). For a contract whose entire purpose is
  two-runtime agreement, the backend suite should assert the same boundary cases so the runtimes
  cannot silently diverge.
- **Fix:** Add backend assertions mirroring the frontend spec cases (exact 32-char requirement,
  illegal `+`, leading hyphen, no underscore).

### D4 — Improvement/Nitpick: Frontend `isBackendApiKeyToken` does not trim, unlike the backend helpers

- **Severity:** Nitpick (latent drift risk)
- **File:line:** `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts:19-21`
  ```typescript
  export function isBackendApiKeyToken(value: string): boolean {
    return value !== '' && backendApiKeyTokenRegex.test(value); // no trim
  }
  ```
- **Inconsistency:** The backend `validateApiKey` (`03_validators.js:49`) and `isValidApiKey`
  (`98_ConfigurationManagerClass.js:306`) both trim internally before testing, whereas this
  frontend helper does not. Today every frontend caller pre-trims (`BackendApiKeyWriteSchema`
  `.trim()` at `backendConfiguration.zod.ts:14`; `BackendSettingsFormSchema` `apiKey:
z.string().trim()` at `backendSettingsForm.zod.ts:55`), so net behaviour agrees. But the helper
  itself is not a faithful mirror of the backend contract and would reject whitespace-padded input
  if ever called on untrimmed data.
- **Fix:** Either document that callers must pre-trim, or have the helper trim internally
  (`value.trim()` then test) to mirror the backend behaviour exactly.

---

## INCIDENTAL FINDINGS

### I1 — Improvement: Stale `API_KEY_PATTERN` getter JSDoc describes the OLD contract

- **Severity:** Improvement
- **File:line:** `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js:95-103`
  ```javascript
  /**
   * Gets the API key pattern regex.
   * Alphanumeric segments separated by single hyphens; no leading/trailing/consecutive hyphens.
   * ...
   */
  static get API_KEY_PATTERN() {
  ```
- **Inconsistency:** This branch changed `API_KEY_PATTERN` in `03_validators.js` to the new
  `prefix_32base64url` contract, but the getter's JSDoc still documents the **previous** hyphen-slug
  contract. It now contradicts the actual pattern it returns and can mislead maintainers.
- **Fix:** Update the getter JSDoc to describe the new contract (alphanumeric prefix + underscore +
  exactly 32 base64url characters), consistent with the comment added at `03_validators.js:6-8`.

### I2 — Nitpick: Class `@example` references a non-existent method and the obsolete key format

- **Severity:** Nitpick
- **File:line:** `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js:11-15`
  ```javascript
   * @example
   * const config = ConfigurationManager.getInstance();
   * const backendAssessorBatchSize = config.getBackendAssessorBatchSize();
   * config.setLangflowApiKey('sk-abc123');
  ```
- **Inconsistency:** There is no `setLangflowApiKey` method (only `setApiKey` at line 484), and
  `'sk-abc123'` is the obsolete key style this branch replaced. The example would throw and teaches
  the wrong format. (Pre-existing, but in the changed contract's file.)
- **Fix:** Change to `config.setApiKey('abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1');` (or a similarly
  representative valid sample).

### I3 — (Verification, no defect) Frontend settings-form schema uses the same shared helper — consistent

- **Severity:** None (positive)
- **File:line:** `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts:74`
- **Note:** The settings form validates `apiKey` via the same `isBackendApiKeyToken` helper (not a
  private duplicate regex), and `apiKey: z.string().trim()` (line 55) ensures trimming before the
  call. This is consistent with both the backend `validateApiKey` and the write transport schema.
  No divergence.

### I4 — (Verification, no defect) `appsscript.json` requires no change

- **Severity:** None (positive)
- **Note:** The API-key contract change is purely a validation rule; it introduces no new GAS
  services or OAuth scopes. `git diff main...HEAD --name-only | grep -i appsscript` returns nothing,
  confirming no manifest change was needed or made. Consistent with `src/backend/AGENTS.md` §7.

### I5 — (Verification, no defect) No stale `sk-`-style fixtures remain

- **Severity:** None (positive)
- **Note:** All API-key fixtures across backend and frontend now use the new `abt_/custom_/cust_`
  32-char base64url style (e.g. `configurationManager.test.js:133`, `backendConfigurationService.spec.ts:65`,
  `backendSettingsForm.zod.spec.ts:9`). No leftover `sk-`-style values that would now mis-validate.

---

## Files read (evidence base)

- `.opencode/agents/code-reviewer.md`
- `src/backend/AGENTS.md`
- `src/backend/ConfigurationManager/03_validators.js` (diff + full)
- `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js` (getter, `isValidApiKey`, class header)
- `src/backend/ConfigurationManager/01_configKeysAndSchema.js` (API_KEY validate wiring)
- `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.ts` (diff + full)
- `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts` (diff + full)
- `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts` (full)
- `tests/configurationManager/configurationManager.test.js` (diff)
- `tests/configurationManager/configurationManagerSection1Red.test.js` (diff)
- `tests/configurationManager/configurationManagerSection1aRed.test.js` (diff)
- `tests/singletons/configurationManagerLazyInit.test.js` (diff)
- `src/frontend/src/services/backendConfiguration/backendConfigurationValidation.spec.ts` (grep)
- `src/frontend/src/services/backendConfiguration/backendConfigurationService.spec.ts` (grep)

> Remember, you must address **all** in-scope review items and then resubmit to the reviewer until the review comes back clean.
