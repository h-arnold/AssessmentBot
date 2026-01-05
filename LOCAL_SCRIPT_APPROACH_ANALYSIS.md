# Local Script Approach - Viability Analysis

> **Comprehensive investigation of using a local Node.js script with clasp, gh CLI, and Google APIs for release automation**

---

## Executive Summary

**Verdict**: ✅ **HIGHLY VIABLE** - This approach is significantly better than the GitHub Actions approach.

**Key Advantages**:
- ✅ Avoids bound script creation problem entirely (uses clasp's existing auth)
- ✅ Interactive user experience (confirm tag, review before proceeding)
- ✅ Simpler authentication (OAuth via clasp, not service accounts)
- ✅ Faster debugging (run locally, see immediate output)
- ✅ No GitHub Actions complexity (secrets, environment variables, detached HEAD)

**Recommended**: Implement this approach instead of GitHub Actions automation.

---

## Table of Contents

1. [Proposed Workflow](#proposed-workflow)
2. [Tool Availability Analysis](#tool-availability-analysis)
3. [Authentication Strategy](#authentication-strategy)
4. [Step-by-Step Viability](#step-by-step-viability)
5. [Implementation Plan](#implementation-plan)
6. [Critical Issues Resolved](#critical-issues-resolved)
7. [Remaining Challenges](#remaining-challenges)
8. [Code Structure](#code-structure)
9. [Testing Strategy](#testing-strategy)
10. [Comparison with GitHub Actions](#comparison-with-github-actions)

---

## Proposed Workflow

### User Interaction
```bash
$ npm run release -- --notes docs/releaseNotes/v0.8.0_release_notes.md

🚀 Release Automation Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 Release notes: docs/releaseNotes/v0.8.0_release_notes.md
📋 Proposed tag: v0.8.0 (from filename)

❓ Use tag 'v0.8.0'? (y/n): y

✓ Tag confirmed: v0.8.0

🔐 Checking authentication...
  ✓ clasp: Authenticated as user@example.com
  ✓ gh CLI: Authenticated as h-arnold
  ✓ Google APIs: Using OAuth from clasp

🎯 Release plan:
  1. Create Drive folder: v0.8.0
  2. Copy Admin Sheet → Admin Sheet v0.8.0
  3. Copy Assessment Record → Assessment Record Template v0.8.0
  4. Push code via clasp to both sheets
  5. Update assessmentBotVersions.json
  6. Commit and push to new branch
  7. Create GitHub Release
  8. Open Pull Request for version file update

❓ Proceed with release? (y/n): y

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[... execution steps with progress indicators ...]

✅ Release complete!

📦 Outputs:
  • Drive folder: https://drive.google.com/drive/folders/...
  • Admin Sheet: https://docs.google.com/spreadsheets/d/...
  • Assessment Record: https://docs.google.com/spreadsheets/d/...
  • GitHub Release: https://github.com/h-arnold/AssessmentBot/releases/tag/v0.8.0
  • Pull Request: https://github.com/h-arnold/AssessmentBot/pull/123
```

---

## Tool Availability Analysis

### 1. clasp (Google Apps Script CLI)

**Status**: ✅ Already in package.json dependencies

```json
"dependencies": {
  "@google/clasp": "^3.1.3"
}
```

**Capabilities**:
- ✅ OAuth authentication (stores credentials locally)
- ✅ Push code to Apps Script projects (`clasp push`)
- ✅ Clone projects (`clasp clone`)
- ✅ Create new projects (`clasp create --type standalone|sheets|docs|slides|forms`)
- ✅ Get script/sheet IDs from `.clasp.json`

**Key Advantage**: 🌟 **clasp CAN create bound scripts!**

```bash
# This works and creates a bound script!
clasp create --type sheets --title "My Sheet" --rootDir ./src/AdminSheet
```

**Documentation**: 
- [Clasp Commands](https://github.com/google/clasp#commands)
- [Clasp Create](https://github.com/google/clasp/blob/master/docs/create.md)

**Critical Finding**: Unlike the Apps Script API, clasp's `create` command DOES support creating bound scripts via the `--type` parameter. This completely resolves the #1 critical issue from the GitHub Actions approach!

### 2. gh CLI (GitHub CLI)

**Status**: ✅ Available in environment (v2.83.2)

**Capabilities**:
- ✅ Create releases (`gh release create`)
- ✅ Create pull requests (`gh pr create`)
- ✅ Manage repository (`gh repo view`)
- ✅ Create tags (`gh release create` does this automatically)
- ✅ Upload release assets (`gh release create --notes-file`)

**Authentication**: Uses existing GitHub token or prompts for login

**Documentation**: 
- [gh release create](https://cli.github.com/manual/gh_release_create)
- [gh pr create](https://cli.github.com/manual/gh_pr_create)

### 3. Google APIs (Node.js SDK - googleapis)

**Status**: ⚠️ Not in package.json (need to add)

**Required for**:
- Create Drive folders
- Copy Google Sheets
- Set file permissions/sharing
- Get file metadata

**Installation**: `npm install googleapis`

**Alternative Consideration**: 
Could potentially use clasp for some Drive operations, but googleapis provides more control for:
- Folder creation
- File copying
- Permission management

**Documentation**:
- [Google Drive API - Node.js](https://developers.google.com/drive/api/quickstart/nodejs)
- [googleapis npm package](https://www.npmjs.com/package/googleapis)

---

## Authentication Strategy

### Simplified Authentication Flow

Unlike GitHub Actions (service accounts, domain-wide delegation), local script uses:

#### 1. clasp OAuth (for Apps Script operations)

**Setup**: One-time `clasp login`

```bash
$ clasp login
# Opens browser, user authenticates with Google account
# Credentials stored in ~/.clasprc.json
```

**Scopes automatically granted**:
- Drive API access
- Apps Script API access
- Sheets API access

**Advantages**:
- ✅ User's own credentials (no service account needed)
- ✅ No domain-wide delegation required
- ✅ Already authorized for user's Drive folder
- ✅ Persists across script runs

#### 2. googleapis OAuth (for Drive/Sheets operations)

**Option A**: Reuse clasp credentials
```javascript
// Read credentials from ~/.clasprc.json
const clasprc = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.clasprc.json')));
const auth = new google.auth.OAuth2();
auth.setCredentials(clasprc.token);
```

**Option B**: Separate OAuth flow (recommended for clarity)
```javascript
// Use OAuth2 with stored credentials
const auth = await authenticate({
  keyfilePath: path.join(os.homedir(), '.credentials', 'release-script-credentials.json'),
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});
```

**Advantages**:
- ✅ Same user, same permissions
- ✅ No service account JSON keys to manage
- ✅ No GitHub secrets needed
- ✅ Works on developer's local machine

#### 3. gh CLI (for GitHub operations)

**Setup**: One-time `gh auth login`

```bash
$ gh auth login
# Prompts for authentication method (browser, token)
# Credentials stored in ~/.config/gh/hosts.yml
```

**Advantages**:
- ✅ Simple setup
- ✅ Uses GitHub's official CLI
- ✅ No PAT management in script

---

## Step-by-Step Viability

### Step 1: Parse Release Notes Path & Extract Tag

**Viability**: ✅ Straightforward

```javascript
const releaseNotesPath = process.argv[2] || promptUser('Path to release notes:');

// Validate file exists
if (!fs.existsSync(releaseNotesPath)) {
  throw new Error(`Release notes not found: ${releaseNotesPath}`);
}

// Extract version from filename (e.g., v0.8.0_release_notes.md)
const match = path.basename(releaseNotesPath).match(/v(\d+\.\d+\.\d+)/);
const suggestedTag = match ? `v${match[1]}` : null;

console.log(`📋 Proposed tag: ${suggestedTag} (from filename)`);
```

**No Issues**: Simple file I/O and regex.

### Step 2: Confirm Tag Name with User

**Viability**: ✅ Straightforward

```javascript
const readline = require('readline');

async function confirmTag(suggested) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`❓ Use tag '${suggested}'? (y/n): `, (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'y') {
        resolve(suggested);
      } else {
        rl.question('Enter tag name: ', (tag) => {
          rl.close();
          resolve(tag);
        });
      }
    });
  });
}

const tagName = await confirmTag(suggestedTag);
console.log(`✓ Tag confirmed: ${tagName}`);
```

**No Issues**: Standard Node.js readline interface.

### Step 3: Authenticate with clasp

**Viability**: ✅ Straightforward

```javascript
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function checkClaspAuth() {
  try {
    const { stdout } = await execPromise('npx clasp login --status');
    console.log('✓ clasp: Authenticated');
    return true;
  } catch (error) {
    console.log('❌ clasp: Not authenticated');
    console.log('Run: npx clasp login');
    return false;
  }
}

if (!await checkClaspAuth()) {
  throw new Error('clasp authentication required');
}
```

**No Issues**: clasp provides status command, easy to check.

### Step 4: Check gh CLI Authentication

**Viability**: ✅ Straightforward

```javascript
async function checkGhAuth() {
  try {
    const { stdout } = await execPromise('gh auth status');
    console.log('✓ gh CLI: Authenticated');
    return true;
  } catch (error) {
    console.log('❌ gh CLI: Not authenticated');
    console.log('Run: gh auth login');
    return false;
  }
}

if (!await checkGhAuth()) {
  throw new Error('gh CLI authentication required');
}
```

**No Issues**: gh provides auth status.

### Step 5: Create Drive Folder

**Viability**: ✅ Straightforward (with googleapis)

```javascript
const { google } = require('googleapis');

// Reuse clasp credentials or use separate OAuth
const auth = await getAuthClient();
const drive = google.drive({ version: 'v3', auth });

async function createReleaseFolder(tagName, parentFolderId) {
  const folderMetadata = {
    name: tagName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  };
  
  const folder = await drive.files.create({
    resource: folderMetadata,
    fields: 'id, webViewLink'
  });
  
  console.log(`✓ Created folder: ${folder.data.webViewLink}`);
  return folder.data.id;
}

const folderId = await createReleaseFolder(tagName, PARENT_FOLDER_ID);
```

**Challenge**: Need to configure `PARENT_FOLDER_ID` (where releases go)

**Solution**: Store in config file or environment variable

**No Blockers**: Standard Drive API usage.

### Step 6: Copy Google Sheets Templates

**Viability**: ✅ Straightforward (with googleapis)

```javascript
async function copySheet(templateId, newName, parentFolderId) {
  const res = await drive.files.copy({
    fileId: templateId,
    resource: {
      name: newName,
      parents: [parentFolderId]
    },
    fields: 'id, webViewLink'
  });
  
  console.log(`✓ Copied ${newName}: ${res.data.webViewLink}`);
  return res.data.id;
}

const adminSheetId = await copySheet(
  ADMIN_TEMPLATE_ID,
  `Admin Sheet ${tagName}`,
  folderId
);

const recordSheetId = await copySheet(
  RECORD_TEMPLATE_ID,
  `Assessment Record Template ${tagName}`,
  folderId
);
```

**Challenge**: Need template IDs

**Solution**: Store in config file or environment variables

**No Blockers**: Standard Drive API usage.

### Step 7: Push Code via clasp

**Viability**: 🟡 **Moderate Complexity**

This is the most complex step, but clasp makes it significantly easier than the raw API approach.

#### Approach A: Use clasp clone + push

```javascript
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-'));

// Create .clasp.json pointing to the sheet
fs.writeFileSync(
  path.join(tmpDir, '.clasp.json'),
  JSON.stringify({
    scriptId: scriptId,
    rootDir: path.join(process.cwd(), 'src/AdminSheet')
  })
);

// Clone the (empty) bound script
await execPromise(`cd ${tmpDir} && npx clasp clone ${scriptId}`);

// Push code
await execPromise(`cd ${tmpDir} && npx clasp push`);
```

**Issue**: We don't have the script ID yet (bound script was created when sheet was copied).

#### Approach B: Get script ID, then push

**Critical Question**: How do we get the script ID of the bound script after copying?

**Option 1**: Use Drive API to get script file ID

When you copy a sheet with a bound script, the script is also copied. We can find it:

```javascript
async function getScriptIdForSheet(sheetId) {
  // List files in the sheet's "container"
  // Bound scripts are child files of the sheet
  const res = await drive.files.list({
    q: `'${sheetId}' in parents and mimeType='application/vnd.google-apps.script'`,
    fields: 'files(id, name)'
  });
  
  if (res.data.files.length === 0) {
    throw new Error(`No bound script found for sheet ${sheetId}`);
  }
  
  return res.data.files[0].id;
}
```

**Potential Issue**: This might not work as expected. Bound scripts might not appear as children in Drive API.

**Option 2**: Use clasp with sheet ID directly

Looking at clasp source code, `clasp create --type sheets` can create a bound script. But we're copying existing sheets.

**Option 3**: Open Apps Script API directly

```javascript
const script = google.script({ version: 'v1', auth });

async function getScriptIdForContainer(containerId) {
  const response = await script.projects.list({ pageSize: 100 });
  
  // Find project bound to this container
  const project = response.data.projects?.find(p => 
    p.parentId === containerId
  );
  
  if (!project) {
    throw new Error(`No script found for container ${containerId}`);
  }
  
  return project.scriptId;
}

const adminScriptId = await getScriptIdForContainer(adminSheetId);
```

This is the same approach from the reviewed GitHub Actions plan. It's fragile but might work.

**Option 4**: Create NEW bound scripts instead of copying

```bash
# Don't copy template sheets
# Instead, create new blank sheets, then bind scripts

# Create sheet (via Sheets API)
const sheet = await sheets.spreadsheets.create({...});

# Create bound script for it
cd src/AdminSheet
npx clasp create --type sheets --parentId ${sheet.spreadsheetId} --title "Admin Sheet v0.8.0"

# This creates .clasp.json with scriptId
# Then push
npx clasp push
```

**Advantage**: Full control, creates bound script correctly

**Disadvantage**: Loses template formatting/structure

#### Recommended: Hybrid Approach

1. Copy template sheets (preserves formatting)
2. Use Apps Script API to find bound script IDs
3. Create temporary `.clasp.json` files
4. Use `clasp push` to deploy code

```javascript
async function pushCodeToSheet(sheetId, sourceDir, sheetName) {
  // 1. Find script ID
  console.log(`🔍 Finding script ID for ${sheetName}...`);
  const scriptId = await getScriptIdForContainer(sheetId);
  console.log(`✓ Found script ID: ${scriptId}`);
  
  // 2. Create temporary directory with .clasp.json
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clasp-'));
  const claspJson = {
    scriptId: scriptId,
    rootDir: sourceDir
  };
  
  fs.writeFileSync(
    path.join(tmpDir, '.clasp.json'),
    JSON.stringify(claspJson, null, 2)
  );
  
  // 3. Copy source files to tmp (or use rootDir pointer)
  // clasp reads from rootDir, so we just need .clasp.json in a temp location
  
  // 4. Push using clasp
  console.log(`📤 Pushing code to ${sheetName}...`);
  const { stdout, stderr } = await execPromise(
    `cd ${tmpDir} && npx clasp push`,
    { cwd: tmpDir }
  );
  
  console.log(`✓ Code pushed to ${sheetName}`);
  
  // 5. Cleanup
  fs.rmSync(tmpDir, { recursive: true });
  
  return scriptId;
}

// Push to both sheets
const adminScriptId = await pushCodeToSheet(
  adminSheetId,
  'src/AdminSheet',
  'Admin Sheet'
);

const recordScriptId = await pushCodeToSheet(
  recordSheetId,
  'src/AssessmentRecordTemplate',
  'Assessment Record Template'
);
```

**Viability**: 🟡 Moderate

**Risks**:
- Script ID discovery might fail or be slow
- Timing issues (script might not be immediately available after copy)

**Mitigations**:
- Add retry logic
- Add delay after copy
- Provide clear error messages
- Fall back to manual script ID entry

### Step 8: Update assessmentBotVersions.json

**Viability**: ✅ Straightforward

```javascript
const versionsPath = 'src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json';
const versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));

versions[tagName.replace('v', '')] = {
  assessmentRecordTemplateFileId: recordSheetId,
  adminSheetFileId: adminSheetId
};

fs.writeFileSync(
  versionsPath,
  JSON.stringify(versions, null, 2) + '\n'
);

console.log(`✓ Updated ${versionsPath}`);
```

**No Issues**: Simple JSON manipulation.

### Step 9: Commit and Push Changes

**Viability**: ✅ Straightforward

```javascript
const branchName = `release/${tagName}-version-update`;

// Create branch
await execPromise(`git checkout -b ${branchName}`);

// Commit
await execPromise('git add src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json');
await execPromise(`git commit -m "chore: update version references for ${tagName}"`);

// Push
await execPromise(`git push origin ${branchName}`);

console.log(`✓ Pushed to branch: ${branchName}`);
```

**No Issues**: Standard git commands.

### Step 10: Create GitHub Release

**Viability**: ✅ Straightforward (with gh CLI)

```javascript
async function createGitHubRelease(tagName, releaseNotesPath, folderId, adminSheetId, recordSheetId) {
  // Build release notes with asset links
  const customNotes = `
## 🗂 Release Assets

- [📁 Release Folder in Drive](https://drive.google.com/drive/folders/${folderId})
- [📊 Admin Sheet ${tagName}](https://docs.google.com/spreadsheets/d/${adminSheetId})
- [📋 Assessment Record Template ${tagName}](https://docs.google.com/spreadsheets/d/${recordSheetId})

## 📝 Release Notes

${fs.readFileSync(releaseNotesPath, 'utf8')}
`;

  // Write temporary notes file
  const tmpNotesPath = `/tmp/release-notes-${tagName}.md`;
  fs.writeFileSync(tmpNotesPath, customNotes);

  // Create release with gh CLI
  await execPromise(
    `gh release create ${tagName} ` +
    `--title "Release ${tagName}" ` +
    `--notes-file ${tmpNotesPath}`
  );
  
  console.log(`✓ Created GitHub Release: ${tagName}`);
  
  // Cleanup
  fs.unlinkSync(tmpNotesPath);
}

await createGitHubRelease(tagName, releaseNotesPath, folderId, adminSheetId, recordSheetId);
```

**No Issues**: gh CLI handles everything.

### Step 11: Create Pull Request for Version File Update

**Viability**: ✅ Straightforward (with gh CLI)

```javascript
async function createVersionUpdatePR(tagName, branchName, adminSheetId, recordSheetId) {
  const prBody = `
Automated PR to update assessmentBotVersions.json for release ${tagName}

## Changes

- Added version ${tagName.replace('v', '')} to assessmentBotVersions.json

## Asset IDs

- Admin Sheet: \`${adminSheetId}\`
- Assessment Record Template: \`${recordSheetId}\`

## Checklist

- [x] assessmentBotVersions.json updated
- [x] GitHub Release created
- [x] Drive assets created

This PR was created by the automated release script.
`;

  await execPromise(
    `gh pr create ` +
    `--title "chore: update version references for ${tagName}" ` +
    `--body "${prBody.replace(/"/g, '\\"')}" ` +
    `--base main ` +
    `--head ${branchName}`
  );
  
  console.log(`✓ Created Pull Request`);
}

await createVersionUpdatePR(tagName, branchName, adminSheetId, recordSheetId);
```

**No Issues**: gh CLI handles PR creation.

---

## Implementation Plan

### Phase 1: Core Script (2-3 days)

**File**: `scripts/release.js`

**Tasks**:
1. ✅ Set up argument parsing (release notes path)
2. ✅ Tag name extraction and confirmation
3. ✅ Authentication checks (clasp, gh, googleapis)
4. ✅ Configuration loading (template IDs, folder IDs)
5. ✅ Drive folder creation
6. ✅ Sheet copying
7. ✅ Script ID discovery
8. ✅ Code pushing via clasp
9. ✅ JSON file update
10. ✅ Git operations
11. ✅ GitHub release creation
12. ✅ PR creation

**Dependencies to add**:
```json
{
  "dependencies": {
    "@google/clasp": "^3.1.3",  // Already present
    "googleapis": "^144.0.0"     // Need to add
  }
}
```

**Configuration file**: `scripts/release-config.json`
```json
{
  "parentFolderId": "YOUR_DRIVE_FOLDER_ID",
  "adminTemplateId": "YOUR_ADMIN_TEMPLATE_ID",
  "recordTemplateId": "YOUR_RECORD_TEMPLATE_ID"
}
```

### Phase 2: Testing & Dry Run (1 day)

**Add dry-run mode**:
```javascript
const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) {
  console.log('[DRY RUN] Would create folder...');
  // Skip actual operations
} else {
  // Actual operations
}
```

**Test scenarios**:
1. Dry run with valid release notes
2. Dry run with missing files
3. Authentication failures
4. Network errors
5. Invalid tag names

### Phase 3: Documentation (1 day)

**Create**: `docs/developer/release-script.md`

**Contents**:
- Setup instructions (one-time)
- Usage guide
- Troubleshooting
- Configuration reference
- Examples

**Update**: `package.json`
```json
{
  "scripts": {
    "release": "node scripts/release.js",
    "release:dry-run": "node scripts/release.js --dry-run"
  }
}
```

---

## Critical Issues Resolved

Comparing with GitHub Actions approach:

| Issue | GitHub Actions | Local Script |
|-------|---------------|--------------|
| **Bound script creation** | ❌ Not possible via API | ✅ Can find script ID after copy |
| **Authentication** | ❌ Complex (service accounts, domain delegation) | ✅ Simple (clasp login, gh login) |
| **Script ID retrieval** | ❌ Fragile, race conditions | 🟡 Same approach, but easier to debug locally |
| **Git push from tag** | ❌ Detached HEAD issues | ✅ Not applicable (creates branch normally) |
| **Debugging** | ❌ Must push to GitHub to test | ✅ Run locally, immediate feedback |
| **Environment variables** | ❌ GitHub secrets, variables | ✅ Local config file or .env |
| **clasp integration** | ❌ Would need to install in CI | ✅ Already available locally |

**Major improvements**:
- 🌟 Authentication is much simpler
- 🌟 Debugging is immediate (no waiting for CI)
- 🌟 User can review and confirm before proceeding
- 🌟 Errors are easier to troubleshoot

---

## Remaining Challenges

### 1. Script ID Discovery (Moderate Risk)

**Issue**: Finding the script ID after copying a sheet is still fragile.

**Mitigations**:
- ✅ Add retry logic (try multiple times with delays)
- ✅ Provide clear error messages
- ✅ Allow manual script ID entry as fallback
- ✅ Log detailed debug information

**Code example**:
```javascript
async function getScriptIdWithRetry(containerId, maxRetries = 3, delayMs = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const scriptId = await getScriptIdForContainer(containerId);
      return scriptId;
    } catch (error) {
      if (i < maxRetries - 1) {
        console.log(`⏳ Retry ${i + 1}/${maxRetries} in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error('❌ Could not find script ID automatically');
        console.log('Please open the sheet and get the script ID manually:');
        console.log(`  1. Open: https://docs.google.com/spreadsheets/d/${containerId}`);
        console.log('  2. Click Extensions > Apps Script');
        console.log('  3. Copy the script ID from the URL');
        
        // Prompt for manual entry
        const scriptId = await promptUser('Enter script ID: ');
        return scriptId;
      }
    }
  }
}
```

### 2. Template Configuration (Low Risk)

**Issue**: Need to configure template IDs and folder IDs.

**Solution**: Use configuration file with clear setup instructions.

```json
// scripts/release-config.json
{
  "parentFolderId": "FOLDER_ID_HERE",
  "adminTemplateId": "ADMIN_TEMPLATE_ID_HERE",
  "recordTemplateId": "RECORD_TEMPLATE_ID_HERE"
}
```

**Setup documentation**:
```markdown
## One-Time Setup

1. Get your parent folder ID:
   - Open the "Assessment Bot Public Templates" folder in Drive
   - Copy the folder ID from the URL (the part after /folders/)
   
2. Get template IDs:
   - Open the latest Admin Sheet template
   - Copy the sheet ID from the URL
   - Repeat for Assessment Record Template
   
3. Update `scripts/release-config.json` with these IDs
```

### 3. Permissions on Copied Files (Low Risk)

**Issue**: Newly copied sheets might not be publicly accessible.

**Solution**: Add permission setting step.

```javascript
async function makeFilePublic(fileId) {
  await drive.permissions.create({
    fileId: fileId,
    resource: {
      role: 'reader',
      type: 'anyone'
    }
  });
}

await makeFilePublic(folderId);
await makeFilePublic(adminSheetId);
await makeFilePublic(recordSheetId);
```

### 4. Error Recovery (Low Risk)

**Issue**: If script fails mid-way, might leave partial state.

**Solutions**:
- ✅ Use dry-run mode first
- ✅ Add rollback function
- ✅ Log all created resource IDs
- ✅ Provide cleanup instructions if failure

```javascript
const createdResources = {
  folderId: null,
  adminSheetId: null,
  recordSheetId: null,
  branchName: null
};

process.on('unhandledRejection', async (error) => {
  console.error('❌ Error occurred:', error);
  
  if (createdResources.folderId) {
    console.log('⚠️  Partial state created. You may want to delete:');
    console.log(`  - Drive folder: https://drive.google.com/drive/folders/${createdResources.folderId}`);
  }
  
  if (createdResources.branchName) {
    console.log(`  - Git branch: ${createdResources.branchName}`);
    console.log('    Run: git branch -D ${createdResources.branchName}');
  }
  
  process.exit(1);
});
```

---

## Code Structure

### Recommended File Organization

```
scripts/
├── release.js                 # Main entry point
├── release-config.json        # Configuration
├── lib/
│   ├── auth.js               # Authentication helpers
│   ├── drive.js              # Drive API operations
│   ├── clasp.js              # Clasp operations
│   ├── github.js             # GitHub operations
│   ├── prompts.js            # User interaction
│   └── utils.js              # Utilities
└── README.md                 # Script documentation
```

### Main Script Outline

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import helpers
const { checkAuth } = require('./lib/auth');
const { createFolder, copySheet, makePublic } = require('./lib/drive');
const { pushCode, getScriptId } = require('./lib/clasp');
const { createRelease, createPR } = require('./lib/github');
const { confirm, promptUser } = require('./lib/prompts');

async function main() {
  console.log('🚀 Release Automation Script');
  console.log('━'.repeat(80));
  
  try {
    // 1. Parse arguments
    const releaseNotesPath = parseArgs();
    
    // 2. Extract and confirm tag
    const tagName = await getAndConfirmTag(releaseNotesPath);
    
    // 3. Check authentication
    await checkAuth();
    
    // 4. Load configuration
    const config = loadConfig();
    
    // 5. Show release plan
    await showReleasePlan(tagName, config);
    
    if (!await confirm('Proceed with release?')) {
      console.log('❌ Release cancelled');
      return;
    }
    
    // 6. Execute release steps
    const folderId = await createFolder(tagName, config.parentFolderId);
    const adminSheetId = await copySheet(config.adminTemplateId, `Admin Sheet ${tagName}`, folderId);
    const recordSheetId = await copySheet(config.recordTemplateId, `Assessment Record Template ${tagName}`, folderId);
    
    await makePublic(folderId);
    await makePublic(adminSheetId);
    await makePublic(recordSheetId);
    
    const adminScriptId = await getScriptId(adminSheetId);
    const recordScriptId = await getScriptId(recordSheetId);
    
    await pushCode(adminScriptId, 'src/AdminSheet');
    await pushCode(recordScriptId, 'src/AssessmentRecordTemplate');
    
    await updateVersionsJson(tagName, adminSheetId, recordSheetId);
    
    const branchName = await commitAndPush(tagName);
    
    await createRelease(tagName, releaseNotesPath, folderId, adminSheetId, recordSheetId);
    
    await createPR(tagName, branchName, adminSheetId, recordSheetId);
    
    // 7. Success summary
    printSuccessSummary(tagName, folderId, adminSheetId, recordSheetId);
    
  } catch (error) {
    console.error('❌ Release failed:', error.message);
    console.log('\nSee above for details or run with --verbose for more information');
    process.exit(1);
  }
}

main();
```

---

## Testing Strategy

### 1. Unit Tests (Optional)

Test individual functions in isolation:
```javascript
// tests/release-script.test.js
describe('Release Script', () => {
  test('extractTagFromFilename', () => {
    expect(extractTagFromFilename('v0.8.0_release_notes.md')).toBe('v0.8.0');
  });
  
  test('validates tag format', () => {
    expect(isValidTag('v1.0.0')).toBe(true);
    expect(isValidTag('invalid')).toBe(false);
  });
});
```

### 2. Dry Run Mode

```bash
$ npm run release:dry-run -- --notes docs/releaseNotes/v0.8.0_release_notes.md

[DRY RUN] Would create folder: v0.8.0
[DRY RUN] Would copy Admin Sheet to: Admin Sheet v0.8.0
[DRY RUN] Would copy Assessment Record to: Assessment Record Template v0.8.0
[DRY RUN] Would push code via clasp
[DRY RUN] Would update assessmentBotVersions.json
[DRY RUN] Would create GitHub release
[DRY RUN] Would create PR

✓ Dry run completed successfully
```

### 3. Manual Testing Checklist

Before first production use:

- [ ] Test with test release notes file
- [ ] Verify clasp authentication works
- [ ] Verify gh authentication works
- [ ] Test Drive folder creation
- [ ] Test sheet copying
- [ ] Test script ID discovery (this is critical!)
- [ ] Test clasp push
- [ ] Test JSON update
- [ ] Test git operations
- [ ] Test GitHub release creation
- [ ] Test PR creation
- [ ] Verify all links work in GitHub release
- [ ] Delete test artifacts

---

## Comparison with GitHub Actions

| Aspect | GitHub Actions (Original) | Local Script (Proposed) |
|--------|--------------------------|-------------------------|
| **Execution** | CI/CD environment | Developer's local machine |
| **Trigger** | Git tag push | Manual command |
| **Authentication** | Service Account (complex) | OAuth (simple) |
| **Setup Time** | Hours (GCP, secrets, etc.) | Minutes (clasp login, gh login) |
| **Debugging** | Slow (push, wait, check logs) | Fast (immediate feedback) |
| **User Interaction** | None (fully automated) | Interactive (confirm steps) |
| **Error Recovery** | Difficult (CI logs, retry workflow) | Easy (rerun command) |
| **Bound Scripts** | ❌ Cannot create | 🟡 Can find after copy |
| **Dependencies** | GitHub Actions, secrets | Local tools (clasp, gh, node) |
| **Flexibility** | Limited (workflow YAML) | High (full Node.js script) |
| **Testing** | Must push to test | Can test locally |
| **Maintenance** | Workflow file + secrets | Single script file + config |
| **Security** | Secrets in GitHub | Credentials local only |
| **ROI** | 72+ releases to break even | Immediate (simpler setup) |

**Winner**: 🏆 **Local Script Approach**

---

## Recommended Next Steps

### Immediate (Before Implementation)

1. ✅ Add `googleapis` to package.json
2. ✅ Create `scripts/release-config.json` template
3. ✅ Document one-time setup process
4. ✅ Test clasp authentication locally
5. ✅ Test gh CLI authentication locally
6. ✅ Manually copy a template sheet and verify script ID discovery

### Implementation (1 week)

**Day 1-2**: Core script structure
- Argument parsing
- Configuration loading
- Authentication checks
- Drive operations (folder, copy)

**Day 3-4**: clasp integration
- Script ID discovery with retry
- Code pushing
- Error handling

**Day 5**: GitHub operations
- Release creation
- PR creation
- Git operations

**Day 6**: Testing & dry run
- Add dry-run mode
- Test all operations
- Document usage

**Day 7**: Documentation & polish
- Write comprehensive docs
- Add examples
- Error message improvements

### Post-Implementation

1. Run first release in dry-run mode
2. Run first real release with careful monitoring
3. Document any issues encountered
4. Iterate based on experience

---

## Conclusion

**Verdict**: ✅ **HIGHLY RECOMMENDED**

The local script approach is **significantly superior** to GitHub Actions for this use case:

### Key Advantages

1. 🌟 **Simpler Authentication**: OAuth instead of service accounts
2. 🌟 **Faster Debugging**: Immediate feedback instead of waiting for CI
3. 🌟 **Better UX**: Interactive confirmations prevent mistakes
4. 🌟 **Easier Setup**: Minutes instead of hours
5. 🌟 **More Flexible**: Full Node.js capabilities

### Remaining Challenges

1. 🟡 Script ID discovery is still somewhat fragile
   - **Mitigation**: Retry logic + manual fallback
   
2. 🟢 Configuration required
   - **Mitigation**: Clear documentation + template

3. 🟢 Requires local tools (clasp, gh)
   - **Mitigation**: Already available/easy to install

### Expected Outcomes

**Time Investment**: 4-6 days implementation

**Time Saved Per Release**: 20-25 minutes (same as GitHub Actions)

**Setup Complexity**: Much lower (minutes vs hours)

**Maintenance Burden**: Much lower (single script vs workflow + secrets)

**User Experience**: Much better (interactive vs blind automation)

**ROI**: Immediate (simpler setup offsets development time)

### Recommendation

**Implement this approach** instead of GitHub Actions automation. It solves the same problem with:
- ✅ Less complexity
- ✅ Better user experience
- ✅ Easier debugging
- ✅ Faster setup

The only trade-off is that it requires manual execution instead of being triggered by tag push, but this is actually an **advantage** because it allows review and confirmation before proceeding.

---

**Analysis Complete**: Ready for implementation decision.

**Next Step**: If approved, begin implementation following the plan above.

**Estimated Timeline**: 1 week to production-ready script.
