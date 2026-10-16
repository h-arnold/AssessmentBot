# Backend File and Folder Organisation

Canonical rules for splitting oversized backend files and grouping `z_Api` transport files by domain.

Read this when a backend source file exceeds the 550-line decomposition trigger, or when two or more `z_Api` files share a common domain prefix.

Use alongside:

- `src/backend/AGENTS.md` — backend non-negotiables and the required-documentation read gate
- `docs/developer/backend/api-layer.md` — API layer design and the sole-transport registry
- `docs/developer/frontend/frontend-architecture.md` — the equivalent frontend file/folder conventions

## Large file decomposition (facade pattern)

When a non-API backend file (`y_controllers/`, `Models/`, `DocumentParsers/`, `Assessors/`,
`RequestHandlers/`, `GoogleDriveManager/`, etc.) exceeds **550 lines**, decomposition is
mandatory. Do not leave a file above this threshold merely because the current change did not
create the excess, or because the file is inconvenient to split. Decompose it using the
**facade-pattern** established by `AssignmentDefinitionController`:

1. **Create a folder** named after the original file/class (e.g. `ABClassController/`).
2. **Create `index.js`** as the facade — it exports the original public class, which delegates
   to sub-classes injected in the constructor.
3. **Create sub-classes** at natural responsibility boundaries. Each sub-class file should own
   one coherent concern (e.g. persistence, validation, response mapping, reference data).
   Name them after their concern (e.g. `ABClassPersistence.js`, `ABClassValidation.js`).

Canonical example — `AssignmentDefinition` controller:

```
y_controllers/AssignmentDefinition/
├── index.js                                    # Facade — AssignmentDefinitionController class
├── AssignmentDefinitionPersistence.js          # Database read/write
├── AssignmentDefinitionRecoveryRules.js        # Recovery and reparse decisions
├── AssignmentDefinitionReferenceData.js        # Reference data resolution
├── AssignmentDefinitionResponseMapper.js        # Response shape mapping
├── AssignmentDefinitionTaskEquivalence.js      # Task-equivalence comparison for reparse
├── AssignmentDefinitionTaskParser.js           # Task document parsing
├── AssignmentDefinitionTaskWeighting.js        # Task weighting logic
├── AssignmentDefinitionUpsertOrchestrator.js   # Upsert orchestration
└── AssignmentDefinitionValidation.js           # Domain validation
```

Rules:

- Do not split files under 550 lines unless there is a clear maintainability reason.
- Treat 550 lines as a hard decomposition trigger for files in scope. If work touches a file
  already above the threshold, decompose that file in the same change.
- Never game the threshold by reformatting code, removing blank lines, joining statements,
  shortening names, or condensing, deleting, or otherwise weakening documentation and JSDoc.
  A lower line count is not decomposition; the file must be split into coherent responsibility
  modules according to the rules above.
- Keep the public API surface (method names and signatures) identical after decomposition;
  the facade must preserve backward compatibility.
- Do not pre-emptively split files that are approaching 550 lines; wait until the threshold
  is crossed or a concrete maintenance need arises.
- When splitting, keep GAS concatenation order in mind — the facade file (`index.js`) must
  load after all sub-class files. Use numeric prefixes on sub-class files if dependency
  ordering requires it.
- Sub-class constructors should accept their dependencies via a single options object
  parameter for consistency with the existing pattern.

## API domain folder organisation (`z_Api`)

When two or more `z_Api` files share a common domain prefix, group them into a domain folder
named after that prefix.

The domain prefix is the leading lowercase segment of the filename, up to but not including the
first capital letter (for example, `abclass` in `abclassMutations.js`, `abclassRead.js`, and
`abclassValidation.js`).

Example — currently grouped `z_Api` files for a domain:

```
z_Api/abclass/
├── abclassMutations.js        # ABClass create/update/delete transport handlers
├── abclassRead.js             # ABClass read transport handlers
└── abclassValidation.js       # Transport-boundary validation
```

Domain grouping need not swallow every file sharing a prefix: the assignment-definition
validators live in `assignmentDefinition/`, while `assignmentDefinitionTransport.js`
deliberately remains flat as a single-file-domain exception.

Rules:

- Create a domain folder when **at least 2 files** share a common domain prefix.
- Keep trailing-underscore private function and `module.exports` patterns intact inside
  the moved files (see `src/backend/AGENTS.md` §4, "API entry layer").
- Keep single-file domains flat in `z_Api/`. Do not create folders for them.
- Update `ALLOWLISTED_METHOD_HANDLERS` import paths in `z_apiHandler.js` if relative paths
  change due to folder nesting.
- Ensure `module.exports` exports are updated to reflect the new path for test imports.
