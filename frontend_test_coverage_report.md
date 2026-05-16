## Frontend Test + Coverage Report

Run: `npm run test:frontend:coverage` completed at 2026-05-15T18:42:38.598Z.

---

### 1) Test Failures

- No test failures detected. All tests passed.
- Ran: 19 tests in AssignmentDefinitionWizardModal, 30 tests in App, 4 tests in apiService specs, etc.
- Status: ✅ All green in run logs.

---

### 2) Coverage Overview and Gaps

**Coverage Summary across src/**

- Statements: 92.44% (1981/2143)
- Branches: 87.24% (1012/1160)
- Functions: 91.32% (653/715)
- Lines: 92.69% (1916/2067)

**Lowest coverage under src/**

- Branch coverage is the weakest area (~87%). Focus on increasing branch coverage to reach >=90% for robust safety.

**Files needing attention (branch % < 90%):**

- src/components: Branches 81.25% (13/16) — add tests exercising branches inside components.
- src/features/settings: Branches 85.71% (42/49) — add edge-case tests for settings backend path.
- src/features/settings/backend: Branches 83.14% (74/89) — add tests for conditional branches in backend feature logic.

**Actionable next steps:**

- Identify uncovered branches in these directories using the HTML report (click into each file/line to see uncovered line numbers).
- Add targeted tests to exercise missing branches and raise branch coverage above 90% overall.

---

### 3) Miscellaneous Warnings/Notes

- **React act(...) warnings:**
  - `src/App.spec.tsx` – multiple tests include state updates needing `act(...)` wrapping per React testing guidance.
  - `src/pages/AssignmentDefinitionWizardModal.spec.tsx` – multiple guard close tests trigger: "The current testing environment is not configured to support act(...)". These are guidance notes, not real errors; still, wrap state updates in `act(...)` to align with user-visible behavior.
- **Locale warning:** `/bin/bash: warning: setlocale: LC_ALL: cannot change locale (en_US.UTF-8)`
  - Harmless in this context; ensure the CI runner sets a valid locale if warnings are undesirable.

---

### 4) Recommendations

1. Raise branch coverage to >=90% by adding tests for conditional paths in:
   - src/components (aim for 90%+ branches)
   - src/features/settings (aim for 90%+ branches)
   - src/features/settings/backend (aim for 85%+ and target 90%)
2. Update tests to wrap React state updates in `act(...)` where noted; this aligns with React docs guidance.
3. Fix locale warning in CI by setting `LC_ALL=en_US.UTF-8` (or another valid UTF-8 locale).

---

**Report generated:** 2026-05-15T18:52:00Z
**Next run (optional):** Run `npm run test:frontend:coverage` again after addressing the above to confirm improvements.
