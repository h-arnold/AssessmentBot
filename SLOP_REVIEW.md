# De-Sloppification Review: Regression Checker Code

**Reviewer**: De-Sloppification Agent
**Date**: 2026-05-13
**Scope**: `scripts/builder/src/regression-checker/` (core validation and entrypoint)

---

## Executive Summary

**Verdict: 🔴 Needs Improvement** — Code contains confirmed duplication, unnecessary verbosity, and poor separation of concerns that add maintenance burden.

Multiple instances where identical logic is implemented separately, command validation checks are duplicated across functions, and overly-named constants obscure simple operations.

---

## 🔴 CRITICAL FINDINGS

### **1. Path Prefix Validation Duplication (High Impact)**

**Location:**

- `run-regression-checker.ts` lines 257–263: `hasForbiddenPathPrefix()`
- `validate-regression-config.ts` lines 219–225: `isCrossPlatformAbsolutePath()`

**Evidence:**
Both functions implement identical logic to detect absolute paths (POSIX `/`, UNC `//`, Windows `C:/`), but with different names and different constant usage:

```typescript
// run-regression-checker.ts
function hasForbiddenPathPrefix(normalisedPath: string): boolean {
  return (
    normalisedPath.startsWith('/') ||
    normalisedPath.startsWith('//') ||
    /^[A-Za-z]:\//u.test(normalisedPath)
  );
}

// validate-regression-config.ts
function isCrossPlatformAbsolutePath(value: string): boolean {
  return (
    value.startsWith('/') ||
    value.startsWith(WINDOWS_UNC_PATH_PREFIX) || // = '//'
    WINDOWS_DRIVE_PATH_PATTERN.test(value) // = /^[A-Za-z]:\//
  );
}
```

**Why it matters:**

- If Windows path handling requirements change (e.g., detecting new path formats), both implementations must be updated separately
- Inconsistent naming creates confusion about intent and reusability across modules
- Code duplication violates DRY principle and increases test burden

**Recommended Action:**

- Extract into a single shared utility in `src/lib/fs.ts` or new `src/lib/path-safety.ts` module
- Export from one place, import by both modules
- Name it consistently (e.g., `isAbsolutePath()` or `isCrossPlatformAbsolutePath()`)

**Impact**: Reduces ~20 lines of duplicated logic, improves consistency.

---

### **2. Command Validation Pattern Checks Duplicated Across Functions (High Impact)**

**Location:** `validate-regression-config.ts`

- Lines 326–336 (inside `validateNpmScriptCheck()`)
- Lines 382–392 (inside `resolveToolFamiliesFromScript()`)

**Evidence:**
Both functions perform identical validation checks on the same script command:

```typescript
// Line 326-336 (validateNpmScriptCheck)
if (MUTATING_COMMAND_PATTERN.test(scriptCommand)) {
  throw new Error(`run.kind=npm-script script ${scriptName} is mutating and not allowed (${scriptCommand}).`);
}

if (CHAINED_COMMAND_PATTERN.test(scriptCommand)) {
  throw new Error(`run.kind=npm-script script ${scriptName} must resolve to a single tool family and cannot be chained.`);
}

const resolvedToolFamilies = resolveToolFamiliesFromScript({...});

// Lines 382-392 (resolveToolFamiliesFromScript)
if (MUTATING_COMMAND_PATTERN.test(scriptCommand)) {
  throw new Error(`run.kind=npm-script script ${options.scriptName} is mutating and not allowed (${scriptCommand}).`);
}

if (CHAINED_COMMAND_PATTERN.test(scriptCommand)) {
  throw new Error(`run.kind=npm-script script ${options.scriptName} must resolve to a single tool family and cannot be chained.`);
}
```

**Call flow:**

1. `validateRegressionConfig()` → `validateNpmScriptCheck()`
2. `validateNpmScriptCheck()` runs checks → calls `resolveToolFamiliesFromScript()`
3. `resolveToolFamiliesFromScript()` runs same checks again
4. On recursive calls within `resolveToolFamiliesFromScript()`, checks run only once

**Why it matters:**

- Guards are evaluated twice on first-level calls, creating unnecessary performance cost
- If pattern rules change (e.g., new mutating flags to detect), both places must be updated
- Unclear whether double-checking is intentional (defense-in-depth) or accidental duplication
- No comment explaining the design rationale

**Recommended Action:**

- Consolidate into a single validation helper function: `validateNpmScriptCommandSafety(scriptCommand, scriptName)`
- Have `validateNpmScriptCheck()` call this helper once
- Have `resolveToolFamiliesFromScript()` either call the helper on first use of `scriptCommand`, or trust that callers have already validated

**Impact**: Eliminates duplication, clarifies intent, improves performance.

---

### **3. Path Traversal Validation: Parallel Implementations (Medium Impact)**

**Location:**

- `run-regression-checker.ts` lines 271–291: `normaliseRelativeSegments()`
- `validate-regression-config.ts` lines 278–302: `assertPathDoesNotTraverseOutsideRepo()`

**Evidence:**
Both functions implement similar logic to detect `..` traversal that escapes repo root, but with different approaches:

```typescript
// run-regression-checker.ts - returns canonicalised segments or null
function normaliseRelativeSegments(segments: string[]): string[] | null {
  const canonicalSegments: string[] = [];
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (canonicalSegments.length === 0) return null;
      canonicalSegments.pop();
      continue;
    }
    canonicalSegments.push(segment);
  }
  return canonicalSegments;
}

// validate-regression-config.ts - throws on escape
function assertPathDoesNotTraverseOutsideRepo(...): void {
  const segments = configuredPath.split('/');
  let relativeDepth = 0;
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (relativeDepth === 0) throw new Error(...);
      relativeDepth -= 1;
      continue;
    }
    relativeDepth += 1;
  }
}
```

**Why it matters:**

- Confusing parallel implementations of the same concept
- If traversal validation rules change (e.g., new restrictions), both must be updated
- Code maintainers are unsure which function to reuse when adding new path validation
- Difficult to test all variations consistently

**Recommended Action:**

- Create a single canonical path-segment normalization function that returns canonicalised segments or null
- Use in both modules (`normaliseRelativeSegments()` in `run-regression-checker.ts` already does this)
- Consolidate into `src/lib/fs.ts` or new `src/lib/path-safety.ts`
- In `validate-regression-config.ts`, wrap the shared function and throw if result is null

**Impact**: Reduces confusion, centralises validation logic, easier to maintain.

---

## 🟡 IMPROVEMENT FINDINGS

### **4. Unnecessary Named Constants for Simple Operations (Low Complexity)**

**Location:** `run-regression-checker.ts` lines 13–14

**Evidence:**

```typescript
const MIN_WRAPPED_VALUE_LENGTH = 2;
const QUOTE_TRIM_OFFSET = 1;

// Used at lines 237–245 in stripWrappingQuotes():
function stripWrappingQuotes(value: string): string {
  if (value.length < MIN_WRAPPED_VALUE_LENGTH) {
    // value.length < 2
    return value;
  }

  const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"');
  const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");

  if (hasDoubleQuotes || hasSingleQuotes) {
    return value.slice(QUOTE_TRIM_OFFSET, value.length - QUOTE_TRIM_OFFSET); // value.slice(1, -1)
  }

  return value;
}
```

**Why it matters:**

- Constants obscure simple, well-known patterns
- Overly verbose for single-use helpers (used only in `stripWrappingQuotes()`)
- `value.slice(1, -1)` is idiomatic JavaScript for removing wrapping characters; `value.length < 2` is self-documenting
- Maintenance overhead: developers must search two locations to understand the operation

**Recommended Action:**
Inline the constants into the function body:

```typescript
function stripWrappingQuotes(value: string): string {
  if (value.length < 2) {
    return value;
  }

  const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"');
  const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");

  if (hasDoubleQuotes || hasSingleQuotes) {
    return value.slice(1, -1);
  }

  return value;
}
```

**Impact**: Reduces cognitive load, improves clarity.

---

### **5. Single-Caller Helper Function (parseRegressionConfig) (Low Complexity)**

**Location:** `validate-regression-config.ts` lines 153–163

**Evidence:**

```typescript
export function validateRegressionConfig(
  options: ValidateRegressionConfigOptions
): RegressionConfig {
  const parsedConfig = parseRegressionConfig(options.rawConfig);  // Called once
  // ... rest of function

function parseRegressionConfig(rawConfig: unknown): RegressionConfigInput {
  try {
    return regressionConfigInputSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Regression config is invalid: ${formatRegressionConfigIssues(error)}`);
    }
    throw error;
  }
}
```

**Why it matters:**

- `parseRegressionConfig()` has exactly one caller: `validateRegressionConfig()` (line 66)
- Function is a thin wrapper around `regressionConfigInputSchema.parse()` with error handling
- Extraction adds a call-stack frame without improving clarity
- Not reused elsewhere in the codebase

**Recommended Action:**
Inline into `validateRegressionConfig()`:

```typescript
export function validateRegressionConfig(
  options: ValidateRegressionConfigOptions
): RegressionConfig {
  let parsedConfig: RegressionConfigInput;
  try {
    parsedConfig = regressionConfigInputSchema.parse(options.rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Regression config is invalid: ${formatRegressionConfigIssues(error)}`);
    }
    throw error;
  }

  const reportDirectory = validateRepoRelativePath(...);
  // ... rest
}
```

**Impact**: Simplifies code, reduces function call overhead.

---

### **6. Minimal Type Guard for Single Use (isRecord) (Low Complexity)**

**Location:** `run-regression-checker.ts` lines 328–330

**Evidence:**

```typescript
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Used twice:
// Line 107: if (!isRecord(rawConfig) || !Array.isArray(rawConfig.checks))
// Line 112: if (!isRecord(check) || typeof check.cwd !== 'string')
```

**Why it matters:**

- Generic type guard used only twice in `getCandidateDirectories()`
- Logic is trivial: check if value is a plain object
- Extracting obscures the simple check; inline code is clearer in context
- If used only in one function, it should live there

**Recommended Action:**
Inline the check or use type assertions only where needed:

```typescript
function getCandidateDirectories(rawConfig: unknown): Set<string> {
  const candidateDirectories = new Set<string>(['.']);

  // Check if rawConfig is an object with checks array
  if (
    typeof rawConfig !== 'object' ||
    rawConfig === null ||
    !Array.isArray((rawConfig as Record<string, unknown>).checks)
  ) {
    return candidateDirectories;
  }

  for (const check of (rawConfig as Record<string, unknown>).checks as unknown[]) {
    if (
      typeof check === 'object' &&
      check !== null &&
      typeof (check as Record<string, unknown>).cwd === 'string'
    ) {
      // ... process check
    }
  }

  return candidateDirectories;
}
```

**Impact**: Reduces abstraction overhead, improves clarity.

---

### **7. Complex Path Validation Function with Multiple Responsibilities (Medium Complexity)**

**Location:** `validate-regression-config.ts` lines 237–267: `validateRepoRelativePath()`

**Evidence:**
The function performs multiple validation steps without clear separation:

1. Trim and length check (lines 243–246)
2. Separator normalization (line 248)
3. Absolute path check (line 249)
4. Traversal validation (line 253)
5. Path resolution and re-validation (lines 255–260)
6. Repo-root allowance check (lines 262–264)
7. Final posix normalization (line 266)

**Why it matters:**

- Single function performs 7 distinct validation steps
- Hard to understand what the full contract is
- Multiple ways to fail make testing and error messages unclear
- Difficult to reuse parts of validation in other contexts
- Over-parameterized with `allowRepoRoot` option

**Recommended Action:**

- Break into smaller, focused helpers: `validateNonEmptyPath()`, `validateAbsolutePathRejection()`, `validateTraversalSafety()`
- Compose them in a clear sequence
- Or simplify the central logic by combining early checks into the path-resolution loop

**Impact**: Improves clarity, testability, and reusability.

---

## SUMMARY OF FINDINGS BY IMPACT

| Finding                                                   | Type                    | Impact                                                     | Effort to Fix |
| --------------------------------------------------------- | ----------------------- | ---------------------------------------------------------- | ------------- |
| **1. Path prefix validation duplication**                 | Duplication             | High – maintenance burden if Windows path handling changes | Medium        |
| **2. Command pattern checks duplicated**                  | Duplication             | High – guards evaluated twice, unclear if intentional      | Medium        |
| **3. Path traversal validation parallel implementations** | Duplication             | Medium – confusing design, test burden                     | Medium        |
| **4. Unnecessary named constants**                        | Verbosity               | Low – obscures simple operations                           | Low           |
| **5. Single-caller parseRegressionConfig()**              | Unnecessary abstraction | Low – adds no clarity                                      | Low           |
| **6. Minimal isRecord() type guard**                      | Unnecessary abstraction | Low – trivial helper used twice                            | Low           |
| **7. Complex validateRepoRelativePath()**                 | Over-complexity         | Medium – multiple responsibilities, hard to understand     | Medium        |

---

## OVERALL CODE HEALTH

**Confirmed Slop:** 3 high-priority duplication issues + 2 medium-priority over-complexity findings
**Maintenance Risk:** Code duplication across two files (path validation, command checks) creates risk if business rules change
**Clarity:** Some helpers are extracted for no clear reason, making logic harder to trace
**Consistency:** Path handling logic is split across modules using different approaches and naming

The core logic is sound, but the code would benefit from:

1. Consolidating duplicated validation logic into shared utilities
2. Removing single-caller helpers
3. Simplifying over-parameterized functions
4. Clarifying the validation flow and separation of concerns

---

## FILES READ

**Mandatory documentation:**

- `/home/developer/AssessmentBot/AGENTS.md` – Core agent contract and cross-component rules
- `/home/developer/AssessmentBot/src/backend/AGENTS.md` – Backend API and validation policies
- `/home/developer/AssessmentBot/scripts/builder/AGENTS.md` – Builder validation and Zod schema standards

**Source files reviewed:**

- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/run-regression-checker.ts` (335 lines)
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/config/validate-regression-config.ts` (595 lines)
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/config/validate-regression-config.zod.ts` (51 lines)
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/run-regression-checker.spec.ts` (test context)
- `/home/developer/AssessmentBot/scripts/builder/src/lib/fs.ts` (shared utilities reference)

**Validation performed:**

- `npm run test:builder -- src/regression-checker/run-regression-checker.spec.ts` ✅ **PASS** (9 tests)
- `npm run lint:builder:check` ✅ **PASS** (no lint violations)
