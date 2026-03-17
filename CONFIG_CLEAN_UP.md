# ConfigurationManager Clean-up Plan

This document lists every method/function in the active backend ConfigurationManager implementation and marks whether it should be **retained** or **removed** based on the current direction:

- remove classroom selection from ConfigurationManager entirely;
- remove previously identified removable configuration parameters;
- **retain** automatic auth revocation support (`revokeAuthTriggerSet`, `daysUntilAuthRevoke`);
- remove `assessmentRecordClassInfo` support entirely.

## Scope

- `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`
- `src/backend/ConfigurationManager/99_globals.js`

## Assumptions

1. Class/course selection will move to a non-ConfigurationManager persistence model and should no longer be read or written via this class.
2. Update/template/folder setup will also move out of this class (or be removed), so methods dedicated to those settings should be removed.

---

## 1) `98_ConfigurationManagerClass.js`

### Retain

- `safeGetPropertyKeys(store)`
- `constructor(isSingletonCreator = false)`
- `ensureInitialized()`
- `maybeDeserializeProperties()`
- `getAllConfigurations()`
- `hasProperty(key)`
- `getProperty(key)`
- `setProperty(key, value)`
- `static get API_KEY_PATTERN()`
- `static get DRIVE_ID_PATTERN()`
- `static get JSON_DB_LOG_LEVELS()`
- `static get CONFIG_KEYS()`
- `static get CONFIG_SCHEMA()`
- `static get DEFAULTS()`
- `isValidApiKey(apiKey)`
- `isValidGoogleDriveFolderId(folderId)`
- `getBackendAssessorBatchSize()`
- `getSlidesFetchBatchSize()`
- `getApiKey()`
- `getBackendUrl()`
- `getRevokeAuthTriggerSet()`
- `getDaysUntilAuthRevoke()`
- `getJsonDbMasterIndexKey()`
- `getJsonDbLockTimeoutMs()`
- `getJsonDbLogLevel()`
- `getJsonDbBackupOnInitialise()`
- `getJsonDbRootFolderId()`
- `getIsAdminSheet()`
- `setBackendAssessorBatchSize(batchSize)`
- `setSlidesFetchBatchSize(batchSize)`
- `setApiKey(apiKey)`
- `setBackendUrl(url)`
- `setJsonDbMasterIndexKey(masterIndexKey)`
- `setJsonDbLockTimeoutMs(timeoutMs)`
- `setJsonDbLogLevel(logLevel)`
- `setJsonDbBackupOnInitialise(flag)`
- `setJsonDbRootFolderId(folderId)`
- `setIsAdminSheet(isAdmin)`
- `setRevokeAuthTriggerSet(flag)`
- `setDaysUntilAuthRevoke(days)`
- `static toBoolean(value)`
- `static toBooleanString(value)`
- `getIntConfig(key, defaultValue, options = {})`

### Remove

#### Classroom / class-info related (remove entirely)

- `getClassInfo()`
- `setClassInfo(classInfo)`
- `_migrateClassInfoFromLegacySheet()`
- `getAssessmentRecordCourseId()`
- `setAssessmentRecordCourseId(courseId)`

#### Removable configuration parameter methods

- `getAssessmentRecordTemplateId()`
- `getAssessmentRecordDestinationFolder()`
- `getUpdateDetailsUrl()`
- `getUpdateStage()`
- `setAssessmentRecordTemplateId(templateId)`
- `setAssessmentRecordDestinationFolder(folderId)`
- `setUpdateDetailsUrl(url)`
- `setUpdateStage(stage)`

#### Support method no longer needed once destination-folder logic is removed

- `_ensureAdminSheetFolder(folderName, persistConfigKey = null)`
- `isValidGoogleSheetId(sheetId)`

---

## 2) `99_globals.js`

### Retain

- `maskApiKey(key)`
- `getConfiguration()`
- `saveConfiguration(config)`

### Remove from `getConfiguration()` payload

- `assessmentRecordTemplateId`
- `assessmentRecordDestinationFolder`
- `updateDetailsUrl`
- `updateStage`

### Remove from `saveConfiguration()` setters

- `assessmentRecordTemplateId`
- `assessmentRecordDestinationFolder`
- `updateDetailsUrl`

### Remove classroom-specific branch entirely

- `if (config.classroom) { ... this.saveClassroom(...) ... }`

(That branch is legacy and tied to classroom selection through ConfigurationManager.)

---

## 3) Config keys/schema alignment implied by the above

When implementation starts, remove these keys from `CONFIG_KEYS` and `CONFIG_SCHEMA`:

- `assessmentRecordTemplateId`
- `assessmentRecordDestinationFolder`
- `assessmentRecordCourseId`
- `updateDetailsUrl`
- `updateStage`
- `assessmentRecordClassInfo`

Retain:

- `revokeAuthTriggerSet`
- `daysUntilAuthRevoke`

alongside backend, API, batching, admin flag, and JSON DB keys.

---

## 4) Removal checklist (next implementation pass)

Use this as the practical checklist when removing config values and supporting methods.

### A. Remove config keys and schema entries

- [x] Remove `ASSESSMENT_RECORD_TEMPLATE_ID` from `CONFIG_KEYS`.
- [x] Remove `ASSESSMENT_RECORD_DESTINATION_FOLDER` from `CONFIG_KEYS`.
- [x] Remove `ASSESSMENT_RECORD_COURSE_ID` from `CONFIG_KEYS`.
- [x] Remove `UPDATE_DETAILS_URL` from `CONFIG_KEYS`.
- [x] Remove `UPDATE_STAGE` from `CONFIG_KEYS`.
- [x] Remove `ASSESSMENT_RECORD_CLASS_INFO` from `CONFIG_KEYS`.
- [x] Remove schema entry for `assessmentRecordTemplateId`.
- [x] Remove schema entry for `assessmentRecordDestinationFolder`.
- [x] Remove schema entry for `assessmentRecordCourseId`.
- [x] Remove schema entry for `updateDetailsUrl`.
- [x] Remove schema entry for `updateStage`.
- [x] Remove schema entry for `assessmentRecordClassInfo`.

### B. Remove ConfigurationManager methods tied to deleted values

- [x] Remove `getAssessmentRecordTemplateId()`.
- [x] Remove `setAssessmentRecordTemplateId(templateId)`.
- [x] Remove `getAssessmentRecordDestinationFolder()`.
- [x] Remove `setAssessmentRecordDestinationFolder(folderId)`.
- [x] Remove `getUpdateDetailsUrl()`.
- [x] Remove `setUpdateDetailsUrl(url)`.
- [x] Remove `getUpdateStage()`.
- [x] Remove `setUpdateStage(stage)`.

### C. Remove classroom/class-info persistence from ConfigurationManager

- [x] Remove `getClassInfo()`.
- [x] Remove `setClassInfo(classInfo)`.
- [x] Remove `_migrateClassInfoFromLegacySheet()`.
- [x] Remove `getAssessmentRecordCourseId()`.
- [x] Remove `setAssessmentRecordCourseId(courseId)`.

### D. Remove support helpers no longer required

- [x] Remove `_ensureAdminSheetFolder(folderName, persistConfigKey = null)` once folder auto-creation for destination settings is no longer needed.
- [x] Remove `isValidGoogleSheetId(sheetId)` once template-ID validation has been removed.

### E. Remove globals payload/setter references

- [x] Remove `assessmentRecordTemplateId` from `getConfiguration()` payload.
- [x] Remove `assessmentRecordDestinationFolder` from `getConfiguration()` payload.
- [x] Remove `updateDetailsUrl` from `getConfiguration()` payload.
- [x] Remove `updateStage` from `getConfiguration()` payload.
- [x] Remove `assessmentRecordTemplateId` setter mapping from `saveConfiguration()`.
- [x] Remove `assessmentRecordDestinationFolder` setter mapping from `saveConfiguration()`.
- [x] Remove `updateDetailsUrl` setter mapping from `saveConfiguration()`.
- [x] Remove legacy `if (config.classroom) { ... }` branch from `saveConfiguration()`.

### F. Update usage sites that currently depend on removed methods/values

- [x] Refactor `ABClass` constructor fallback that reads `getAssessmentRecordCourseId()`.
- [x] Refactor `AssignmentController` course ID lookup that reads `getAssessmentRecordCourseId()`.
- [x] Replace any remaining classroom-selection flow that assumes ConfigurationManager persistence.

### G. Keep and verify auth-revocation behaviour

- [x] Keep `revokeAuthTriggerSet` key and schema.
- [x] Keep `daysUntilAuthRevoke` key and schema.
- [x] Keep `getRevokeAuthTriggerSet()` / `setRevokeAuthTriggerSet(flag)`.
- [x] Keep `getDaysUntilAuthRevoke()` / `setDaysUntilAuthRevoke(days)`.
- [x] Verify trigger/auth-revocation call paths still use retained settings after removals.

### H. Documentation and tests follow-up

- [x] Update any backend docs that still mention removed configuration values.
- [x] Update/trim tests that assert removed config keys or methods.
- [x] Run backend lint/tests after removals and resolve failures caused by deleted APIs.
