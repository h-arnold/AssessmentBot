# Code Review — `spreadsheetToMarkdownTable.spec.ts` (Section 2 RED re-review)

**Reviewer:** Code Reviewer (frontend)
**Date:** 2026-07-19
**Scope:** Final re-review of the RED-phase test file after the doc-comment fix.
**Verdict:** CLEAN — RED phase approved to proceed to GREEN.

---

## Files read

1. `/home/developer/AssessmentBot/SPEC.md` — SPREADSHEET → markdown helper section.
2. `/home/developer/AssessmentBot/ACTION_PLAN.md` — Section 2 (`spreadsheetToMarkdownTable`).
3. `/home/developer/AssessmentBot/src/frontend/AGENTS.md` — frontend agent contract.
4. `/home/developer/AssessmentBot/src/frontend/src/features/classPage/spreadsheetToMarkdownTable.spec.ts` — file under review.
5. `/home/developer/AssessmentBot/docs/developer/frontend/frontend-testing.md` — test-naming / traceability rules.

---

## Findings: CLEAN

No Critical, Improvement, or Nitpick findings. The previously reported finding
(doc comment separator illustration contradicting the assertions) is confirmed
fixed. All in-scope verification points pass:

### 1. Doc comment matches assertions

- Separator row in the doc comment (line 14: ` * | --- | --- |`) uses the
  three-dash `---` form and matches the assertions (lines 63, 79, 99, 116:
  `'| --- | --- |'`, `'| --- |'`).
- Null-cell rendering note (line 23: `|  |`) matches the assertion at line 101
  (`'| Bob |  |'`).
- Pipe-escaping note (line 25: escaped as `\|`) matches the
  `String.raw`| A \| B |` assertion at line 115.
- No trailing whitespace anywhere in the file (verified via `grep -P ' +$'` →
  none).

### 2. All 5 required cases present, distinct, contract-matching

Per ACTION_PLAN.md Section 2 "Required test cases (Red first)":

1. Empty array → `''` (lines 49–51). ✔
2. `[['A','B'],[1,2]]` → GFM table, header + 1 data row (lines 56–68). ✔
3. `[['Name','Score']]` → header-only table (lines 73–83). ✔
4. `[['Name','Score'],['Alice',95],['Bob',null]]` → null cell empty, number as
   string (lines 88–105). ✔
5. Cell with `|` → escaped as `\|` (lines 110–121). ✔

Each test asserts the exact expected markdown string (`toEqual` of trailing-`\n`
joined array), so behaviour is pinned rather than implementation detail.

### 3. Standards

- **British English:** No American spellings found (`behaviour`, `colour`,
  `favour`, `optimise`, `initialise`, `serialise`, `organise` all absent;
  wording is neutral/correct). ✔
- **No action-plan numbering in `it()` titles:** Titles are behavioural
  ("returns an empty string for an empty array", "converts header row and one
  data row into a GFM table", "produces header + separator even when there are
  no data rows", "renders null cells as empty and numbers as strings",
  "escapes pipe characters inside cell values as \\|"). No `Section 2` /
  `Section2` labels. ✔ (frontend-testing.md §"Test naming and traceability")
- **No unused imports:** `describe`, `it`, `expect`, the imported
  `spreadsheetToMarkdownTable`, and the local `SpreadsheetRows` type are all
  used. ✔
- **Lint-clean (this file):** `npx eslint src/features/classPage/spreadsheetToMarkdownTable.spec.ts` → exit 0, no output. ✔
- **Fixtures well-typed:** `SpreadsheetRows = Array<Array<string | number | null>>`
  is defined (lines 35–39) and every inline fixture is annotated
  `: SpreadsheetRows`. ✔
- **No `console.*`:** none present. ✔

### 4. Out-of-scope (confirmed, not blocking)

- Implementation module `spreadsheetToMarkdownTable.ts` does not exist
  (`ls` → No such file). Import fails to resolve at RED phase, so the test fails
  to load — expected and correct for RED. Not counted as a defect.
- Pre-existing `apiService.spec.ts` warning is explicitly out of scope per the
  re-review brief and was not inspected.

---

## Conclusion

The test file is correct, complete, standards-compliant, and lint-clean for the
file under review. **RED phase is approved to proceed to GREEN.**

> Remember, you must address **all** in-scope review items and then resubmit to
> the reviewer until the review comes back clean.
