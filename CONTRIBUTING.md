# Contributing

Thank you for considering contributing to AssessmentBot! Contributions of all kinds are welcome.

---

## Codebase Overview

AssessmentBot has three active modules, each with its own runtime, language, and standards:

| Module   | Path               | Runtime                | Language                  |
| -------- | ------------------ | ---------------------- | ------------------------- |
| Backend  | `src/backend/`     | Google Apps Script V8  | GAS-compatible JavaScript |
| Frontend | `src/frontend/`    | Browser (Vite + React) | TypeScript                |
| Builder  | `scripts/builder/` | Node.js                | TypeScript                |

> ⚠️ `src/AdminSheet/` and `src/AssessmentRecordTemplate/` are **deprecated** reference areas. Do not add new features there.

Each module has a detailed `AGENTS.md` that describes its conventions and constraints. Read the relevant one before working in that area:

- [src/backend/AGENTS.md](src/backend/AGENTS.md)
- [src/frontend/AGENTS.md](src/frontend/AGENTS.md)
- [scripts/builder/AGENTS.md](scripts/builder/AGENTS.md)
- [AGENTS.md](AGENTS.md) — cross-component rules

Detailed developer documentation lives under [docs/developer/](docs/developer/).

---

## Getting Started

```bash
# Install all root dependencies (also installs Husky git hooks)
npm install

# Install frontend dependencies
npm --prefix src/frontend install
```

---

## Running Tests

### Backend (tests at repo root)

```bash
npm test                   # default suite (excludes legacy UI tests)
npm run test:all           # full suite including legacy UI tests
vitest run --coverage      # with coverage
```

### Frontend

```bash
npm run frontend:test
npm run frontend:test:coverage
npm run frontend:test:e2e   # Playwright end-to-end tests
```

### Builder

```bash
npm run builder:test
npm run builder:test:coverage
```

---

## Linting and Type Checking

Style and most code quality rules are enforced automatically by ESLint and CI. Run checks locally before pushing:

```bash
npm run lint              # backend GAS JavaScript
npm run frontend:lint     # frontend TypeScript/React
npm run builder:lint      # builder TypeScript
```

TypeScript compile checks:

```bash
npm exec tsc -- -b src/frontend/tsconfig.json
npm run build
```

---

## Core Principles

Most formatting rules are enforced by the linter. These are the things it cannot catch:

- **British English** in all code comments, identifiers, and user-facing text (e.g. `colour`, `initialise`, `serialise`).
- **KISS** — implement the simplest working solution. No speculative abstractions.
- **Fail fast** — never swallow errors silently. No empty `catch` blocks. No `console.*`.
- **No defaults unless instructed** — do not introduce default parameter values unless the task explicitly requires them.
- **No scope creep** — only fulfil what was explicitly asked.

---

## Error Handling (Backend)

Backend code follows a two-channel logging contract:

- **User-facing errors**: `ProgressTracker.getInstance().logError(message, { err })`
- **Developer diagnostics**: `ABLogger.getInstance().error/warn/info(...)`

Do not duplicate the same error details in both. Log and rethrow at top-level boundaries. Never use `console.*`.

```javascript
try {
  // core logic
} catch (err) {
  ProgressTracker.getInstance().logError('Readable user message', { err });
  ABLogger.getInstance().error('Contextual dev message', err);
  throw err;
}
```

---

## Writing Backend Tests

Backend tests run in Node via Vitest and must not depend on live GAS services. Many backend classes call GAS globals in their constructors, which will throw in a Node environment.

**Prefer rehydration over construction:**

```javascript
// Bad: constructor may call GAS services
// const a = new Assignment('courseId', 'assignmentId');

// Good: restores state without invoking the constructor
const a = Assignment.fromJSON({ courseId: 'c1', assignmentId: 'as1' });
```

If a class has no `fromJSON()` method and you need constructor behaviour, mock the required globals in your test setup file, or refactor the constructor to separate the side-effecting logic. See [docs/developer/backend/rehydration.md](docs/developer/backend/rehydration.md) and [docs/developer/backend/backend-testing.md](docs/developer/backend/backend-testing.md) for more detail.

---

## Pre-Submission Checklist

- [ ] All relevant lint checks pass (`npm run lint`, `frontend:lint`, `builder:lint`)
- [ ] TypeScript compiles cleanly (frontend and builder)
- [ ] Tests pass and new logic has test coverage
- [ ] No `console.*` calls introduced
- [ ] No eager heavy work in top-level scope (no Drive/Properties/Classroom access during file load or construction)
- [ ] Singletons accessed via `Class.getInstance()`, never `new Class()`
- [ ] British English used throughout
- [ ] `docs/developer/` updated if the change affects documented behaviour

---

## Submitting a Pull Request

1. Fork the repository and clone it locally.
2. Create a branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. Make your changes, run the checks above, and commit.
4. Open a pull request with a clear description of what changed and why.

---

## Git Hooks (Husky)

`npm install` installs a `pre-commit` hook that runs `npm run lint` automatically. Node.js v18 or later is required.

To reinstall hooks manually:

```bash
npx husky
```
