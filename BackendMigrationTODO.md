# AssessmentBot Backend Migration: Move to New Backend

## High-Level Summary

The new AssessmentBot backend API simplifies the flow for handling image tasks and assessments. Instead of uploading images and tracking URLs, images are now sent directly as base64-encoded strings in the request payload. The API also streamlines configuration, removing the need for tweak IDs and reducing the number of required options. This migration will refactor the codebase to use the new API, update configuration management, and ensure all assessment flows (text, table, image) are compatible with the new backend.

## API Docs for New Backend

````markdown
# API Documentation

## Introduction

This document provides an overview of the Assessment Bot Backend API, detailing available endpoints, authentication methods, and data structures.

## Base URL

The base URL for the API is `http://localhost:3000` when running locally.

## Authentication

API access is secured using API Keys. Provide your API key in the `Authorization` header as a Bearer token.

**Example:**

`Authorization: Bearer your_api_key_here`

## Endpoints

### Assessor Endpoint

This endpoint is responsible for initiating an assessment. It accepts a JSON payload containing the details of the assessment task, including the type of task (text, table, or image), a reference solution, a template, and the student's response. The endpoint is secured with an API key.

- **URL:** `/v1/assessor`
- **Method:** `POST`
- **Description:** Initiates an assessment based on the provided task details.
- **Request Body:** `application/json`

  **Schema:**

  ```json
  {
    "taskType": "TEXT | TABLE | IMAGE",
    "reference": "string | Buffer (base64 encoded for images)",
    "template": "string | Buffer (base64 encoded for images)",
    "studentResponse": "string | Buffer (base64 encoded for images)"
  }
  ```
````

- `taskType`: (Required) The type of assessment task. Must be one of `TEXT`, `TABLE`, or `IMAGE`.
- `reference`: (Required) The reference solution or content for the assessment. Can be a string (for TEXT/TABLE) or a base64 encoded string/Buffer (for IMAGE).
- `template`: (Required) The template or instructions for the assessment. Can be a string (for TEXT/TABLE) or a base64 encoded string/Buffer (for IMAGE).
- `studentResponse`: (Required) The student's response to be assessed. Can be a string (for TEXT/TABLE) or a base64 encoded string/Buffer (for IMAGE).

**Image Validation**

When `taskType` is `IMAGE`, the following validation rules apply to the `reference`, `template`, and `studentResponse` fields:

- **Maximum Image Size:**
  - The maximum allowed image size is configured via the `MAX_IMAGE_UPLOAD_SIZE_MB` environment variable (default: 1 MB).
  - Any image exceeding this size will be rejected with a `400 Bad Request` error.
- **Allowed Image MIME Types:**
  - Only images with MIME types listed in the `ALLOWED_IMAGE_MIME_TYPES` environment variable (comma-separated, default: `image/png`) are accepted.
  - Disallowed types (e.g., GIF, BMP) will be rejected with a `400 Bad Request` error.
- **Supported Formats:**
  - Images may be provided as Buffers or base64-encoded strings (with or without a data URI prefix).
  - The pipe will infer the MIME type and size, and reject invalid or malformed images.
- **Error Responses:**
  - `400 Bad Request`: Returned if the image is too large, of a disallowed type, or malformed. Error messages will indicate the reason (e.g., "Image exceeds maximum size", "Disallowed MIME type").

**Example (`TEXT` task):**

```json
{
  "taskType": "TEXT",
  "reference": "The quick brown fox jumps over the lazy dog.",
  "template": "Write a sentence about a fox.",
  "studentResponse": "A fox is a mammal."
}
```

- **Response (201 Created):**

  ```json
  {
    "message": "Assessment created successfully"
  }
  ```

- **Error Responses:**
  - `400 Bad Request`: If the request body is invalid (e.g., missing required fields, incorrect data types, or inconsistent types for `IMAGE` taskType fields).
  - `401 Unauthorized`: If no API key is provided or the API key is invalid.

### Health Check

The health check endpoint provides information about the application's status.

- **URL:** `/health`
- **Method:** `GET`
- **Description:** Returns the current status of the application, including its name, version, and a timestamp.
- **Response:**
  ```json
  {
    "status": "ok",
    "applicationName": "Assessment Bot Backend",
    "version": "0.0.1",
    "timestamp": "2025-07-07T12:00:00Z"
  }
  ```
  _(Note: The `timestamp` will reflect the actual time of the request, and `applicationName` and `version` are retrieved dynamically from `package.json`.)_

## Error Handling

Details on error handling and common error codes will be provided here as the API develops.

```

## Migration Checklist

### 1. Update Configuration Management

  - [ ] Remove all tweak ID config options (text, table, image assessment tweak IDs).
    - [ ] Remove `getTextAssessmentTweakId` method.
    - [ ] Remove `getTableAssessmentTweakId` method.
    - [ ] Remove `getImageAssessmentTweakId` method.
    - [ ] Remove all related setters and config keys.
  - [ ] Retain only: backend URL, batch size, and API key.
    - [ ] Ensure only `LANGFLOW_URL` (rename to backend URL if needed), `BATCH_SIZE`, and `LANGFLOW_API_KEY` are present.
  - [ ] Update `ConfigurationManager` to reflect new config requirements.
    - [ ] Remove unused config keys: 
    - [ ] Remove `TEXT_ASSESSMENT_TWEAK_ID` from `ConfigurationManagerClass.js` 
    - [ ] Remove `TABLE_ASSESSMENT_TWEAK_ID` from `ConfigurationManagerClass.js` 
    - [ ] Remove `IMAGE_ASSESSMENT_TWEAK_ID` from `ConfigurationManagerClass.js` 
     - [ ] Update validation logic: 
        - [ ] Update `validateConfig()` based on the remaining config keys.
        - [ ] Remove validation for tweak IDs 

  - [ ] Update any UI or setup flows that reference removed config options.
    - [ ] Update setup scripts:
      - [ ] src/frontend/UpdateAndInitManager/FirstRunManager.js
      - [ ] src/frontend/UpdateAndInitManager/UpdateWizard.html
      - [ ] src/frontend/UpdateAndInitManager/SheetCloner.js
    - [ ] Review and update config prompts in setup scripts for removed tweak IDs and legacy config options:
      - [ ] src/frontend/UpdateAndInitManager/FirstRunManager.js (remove/update any prompts for tweak IDs or legacy config keys)
      - [ ] src/frontend/UpdateAndInitManager/UpdateWizard.html (remove/update any UI elements for tweak IDs or legacy config keys)
    - [ ] Update onboarding flows:
      - [ ] src/frontend/UpdateAndInitManager/FirstRunManager.js
      - [ ] src/frontend/UpdateAndInitManager/UpdateWizard.html
    - [ ] Review onboarding flows for references to text/table/image assessment config options and update as needed:
      - [ ] src/frontend/UpdateAndInitManager/FirstRunManager.js (remove/update any onboarding logic for legacy config options)
      - [ ] src/frontend/UpdateAndInitManager/UpdateWizard.html (remove/update any onboarding UI for legacy config options)
    - [ ] Update admin sheets referencing tweak IDs:
      - [ ] src/frontend/y_controllers/UpdateController.js
      - [ ] src/frontend/UpdateAndInitManager/SheetCloner.js
      - [ ] src/frontend/UpdateAndInitManager/FirstRunManager.js

    - [ ] Update `ConfigurationDialog.html` to remove legacy config options:
      - [ ] Remove input fields for `textAssessmentTweakId`, `tableAssessmentTweakId`, `imageAssessmentTweakId`, and `imageFlowUid`.
      - [ ] Remove any JS logic that populates or saves these fields.
      - [ ] Update form data structure to only include backend URL, batch size, and API key (plus any other retained config options).
      - [ ] Update labels and references from "Langflow" to "Backend" if required.
      - [ ] Update validation logic to only require backend URL, batch size, and API key.
      - [ ] Update JSDoc and inline comments to reflect new config options.
      - [ ] Commit your changes and note the short commit ID here: `COMMIT ID GOES HERE`

### 2. Refactor Image Assessment Flow

  - [ ] Remove image upload logic and URL tracking from `ImageManager` and related classes.
    - [ ] Remove `batchUploadImages` method.
    - [ ] Remove `trimFilePathForLangflow` method.
    - [ ] Remove any logic handling image URLs.
  - [ ] Update image extraction to convert slide images directly to base64 strings.
    - [ ] Refactor `batchFetchImages` to output base64 strings instead of blobs.
    - [ ] Add helper method for base64 conversion if needed.
  - [ ] Refactor request construction to use base64-encoded images for `reference`, `template`, and `studentResponse` fields.
    - [ ] Update `generateRequestObjects` in `LLMRequestManager.js` for image tasks.
    - [ ] Update any related logic in `ImageManager.js`.
  - [ ] Ensure all image requests use the new `/v1/assessor` endpoint with correct payload schema.
    - [ ] Update endpoint in request logic.
    - [ ] Validate payload structure matches API documentation.
  - [ ] Remove any code that handles image URLs or file path trimming for Langflow compatibility.
    - [ ] Remove all URL/path logic from `ImageManager.js`.
    - [ ] Commit your changes and note the short commit ID here: `COMMIT ID GOES HERE`

### 3. Refactor Text and Table Assessment Flows

  - [ ] Update request construction for text and table tasks to use the new `/v1/assessor` endpoint and payload schema.
    - [ ] Refactor `generateRequestObjects` in `LLMRequestManager.js` for text and table tasks.
    - [ ] Validate payload structure matches API documentation.
  - [ ] Remove any references to tweak IDs or legacy endpoints.
    - [ ] Remove tweak ID logic from `LLMRequestManager.js`.
    - [ ] Remove tweak ID logic from `ConfigurationManagerClass.js`.
    - [ ] Update any UI/config flows referencing legacy endpoints.
    - [ ] Commit your changes and note the short commit ID here: `COMMIT ID GOES HERE`

### 4. Update API Request Logic

  - [ ] Ensure all requests use the new authentication method: `Authorization: Bearer <API_KEY>`.
    - [ ] Update header logic in `sendRequestWithRetries` in `BaseRequestManager.js`.
    - [ ] Update all request construction in `LLMRequestManager.js`.
  - [ ] Update error handling to match new backend error responses (400, 401, etc.).
    - [ ] Refactor error handling blocks in `sendRequestWithRetries` in `BaseRequestManager.js`.
    - [ ] Update error handling in `LLMRequestManager.js`.
  - [ ] Refactor batch request logic to use the new endpoint and payloads.
    - [ ] Update `sendRequestsInBatches` in `BaseRequestManager.js`.
    - [ ] Update batch logic in `LLMRequestManager.js`.
    - [ ] Commit your changes and note the short commit ID here: `COMMIT ID GOES HERE`

### 5. Update Documentation

  - [ ] Update internal documentation to reflect new backend flow and configuration.
    - [ ] Update `README.md`.
    - [ ] Update files in `docs/`.
    - [ ] Update inline JSDoc in affected classes/methods.
  - [ ] Remove references to Langflow, tweak IDs, and image upload endpoints.
    - [ ] Remove from `README.md`.
    - [ ] Remove from `docs/`.
    - [ ] Remove from onboarding/setup guides.
  - [ ] Add examples for new API payloads and responses.
    - [ ] Add to `README.md`.
    - [ ] Add to `docs/`.
    - [ ] Add code comments in `LLMRequestManager.js`, `ImageManager.js`.
    - [ ] Commit your changes and note the short commit ID here: `COMMIT ID GOES HERE`

### 6. Clean Up Legacy Code
  - [ ] Remove unused methods, classes, and config options related to the old backend.
    - [ ] Remove upload logic from `ImageManager.js`.
    - [ ] Remove URL/path helpers from `ImageManager.js`.
    - [ ] Remove tweak ID logic from `ConfigurationManagerClass.js`.
    - [ ] Remove any legacy Langflow code.
  - [ ] Refactor or remove any code that is no longer relevant (e.g., image upload helpers, tweak ID logic).
    - [ ] Refactor/remove in `ImageManager.js`.
    - [ ] Refactor/remove in `LLMRequestManager.js`.
    - [ ] Refactor/remove in `ConfigurationManagerClass.js`.
  - [ ] Ensure codebase is clean and maintainable post-migration.
    - [ ] Review for dead code.
    - [ ] Update comments.
    - [ ] Ensure maintainability.
- [ ] Commit your changes and note the short commit ID here: `COMMIT ID GOES HERE`
```

---

**Note:** Complete each step in order, and check off each item as you go. This migration will simplify the codebase, improve performance, and make future maintenance easier.
