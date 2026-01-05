# Release Automation Plan - REVIEWED WITH ANNOTATIONS

> **⚠️ CRITICAL REVIEW NOTICE**: This plan has been thoroughly reviewed and contains numerous issues that would prevent successful automation. Please read all annotations marked with 🔴 (Critical), 🟡 (Major), and 🟢 (Minor) before proceeding.

---

## Current Manual Workflow

At present, the (manual) workflow goes like so:

1. Create a new folder in this public Google Drive folder with matching the release tag name: Assessment Bot Public Templates - Google Drive

2. Create two new Google Sheets in that folder called Admin Sheet {release tag} and Assessment Record Template {release tag}. Example here: https://drive.google.com/drive/folders/1xk7wQEX8jLKa0sKhBdkrSA7WJUucpPhv?usp=sharing

3. Update `AssessmentBotVersions.json` with the fileIds of the newly created sheets. Link to the file here: https://github.com/h-arnold/AssessmentBot/blob/main/src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json

4. Open up the GAS App Script Editor for each Google Sheet, rename the App Script project to match the Google Sheets File and get the script ids.

5. Put the scripts IDs into the relevant clasp.json files in the AdminSheet and AssessmentRecordTemplate folders.

> 🟢 **ANNOTATION**: The repository does NOT currently have clasp.json files. A search reveals no `.clasp.json` or `clasp.json` files exist in the codebase. This step may be outdated or the files are gitignored. Need to clarify whether clasp is actually used or if this is aspirational.

6. Push the code relevant pieces of code to the correct scripts.

> 🟡 **ANNOTATION**: "Relevant pieces of code" needs clarification:
> - AdminSheet has 77+ JavaScript files across multiple subdirectories
> - AssessmentRecordTemplate has only 5 files (1 JS + menus subdirectory)
> - Files use numeric prefixes (00_, zz_) for load order which MUST be preserved
> - Need to specify: Are subdirectory structures flattened? How are files concatenated?

7. Create release notes which detail the changes and link to the new file. Example here: https://raw.githubusercontent.com/h-arnold/AssessmentBot/refs/heads/main/docs/releaseNotes/v0.7.6_release_notes.md

> 🟡 **ANNOTATION**: The example release note (v0.7.6) is highly detailed with:
> - Breaking change warnings
> - Feature descriptions
> - Technical changelog
> - File-by-file change list
> - Update instructions
> 
> Simply auto-generating from commits won't match this quality. Consider:
> - Require manual draft that automation enhances?
> - Use conventional commits to extract sections?
> - Keep release notes manual but automate linking to assets?

---

### **The Architecture**

1. **Authentication**: Use a Google Cloud Service Account (SA). You will share your "Assessment Bot Public Templates" Drive folder with this SA's email address so it can create files there.

> 🟡 **ANNOTATION - Authentication Requirements**:
> 
> According to [Google Cloud Service Account documentation](https://cloud.google.com/iam/docs/service-accounts), when a Service Account creates files in a shared folder:
> - The Service Account becomes the owner of created files
> - Files are NOT automatically shared publicly
> - You'll need to explicitly set permissions on each created file
> 
> Additionally, for Apps Script API access:
> - Service Account needs domain-wide delegation if accessing user-owned containers
> - See: https://developers.google.com/apps-script/api/how-tos/service-accounts
> - This requires Google Workspace Admin access, not just folder sharing
> 
> **Action Required**: Add step to configure domain-wide delegation or switch approach.

2. **Templates**: Maintain "Clean Templates" (Google Sheets with layout/formatting but **no bound scripts**) in your Drive. This is crucial because it allows the automation to:

- Copy the sheet (getting the new Sheet ID).
- Create a _new_ bound script project on that sheet (immediately getting the new Script ID).
- Push the code.
- _Note: If you copy a sheet that already has a script, retrieving the new script's ID programmatically is difficult and unreliable._

> 🔴 **CRITICAL ISSUE - This Architecture is FUNDAMENTALLY FLAWED**:
> 
> The Apps Script API does NOT support creating bound scripts programmatically. According to the [Apps Script API documentation](https://developers.google.com/apps-script/api/reference/rest/v1/projects/create):
> 
> 1. `projects.create` can only create **standalone** scripts, not bound scripts
> 2. The `parentId` parameter is for organizational parent resources (folders), NOT for binding to a container
> 3. Bound scripts are implicitly created when you first open the Script Editor for a Sheet/Doc/Form
> 4. There is NO API method to programmatically create a bound script container
> 
> **The Contradiction**:
> - Clean templates have NO bound script
> - You cannot create a bound script via API
> - Therefore, you cannot get a script ID to push code to
> 
> **Alternative Approaches**:
> 
> **Option A**: Copy templates WITH existing bound scripts
> - Copy the sheet (includes bound script copy)
> - Use `script.projects.get` with the container ID to find the new script ID
> - This requires knowing the container-to-script mapping
> - Google doesn't provide direct API for this - requires listing all projects and matching
> 
> **Option B**: Use clasp with manual script creation
> - Keep manual step 4 (open Script Editor once to create bound container)
> - Then use clasp to push code
> - Partially automated but requires human intervention
> 
> **Option C**: Use standalone scripts + Web App binding (different architecture)
> - Create standalone scripts
> - Deploy as web apps
> - Sheets call the web apps (not bound scripts)
> - This changes your entire application architecture
> 
> **Recommended**: Option A with templates that HAVE bound scripts, but acknowledge the script ID retrieval is complex and potentially fragile.

---

### **Step-by-Step Implementation**

#### **1. Google Cloud Setup (One-time)**

1. **Create a GCP Project**: Go to the Google Cloud Console and create a project (e.g., `assessment-bot-deploy`).

> 🟢 **ANNOTATION**: Link to instructions: https://cloud.google.com/resource-manager/docs/creating-managing-projects

2. **Enable APIs**: Enable the following APIs for this project:

- **Google Drive API**
- **Google Apps Script API**
- **Google Sheets API**

> 🟢 **ANNOTATION**: Add required API links:
> - [Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
> - [Apps Script API](https://console.cloud.google.com/apis/library/script.googleapis.com)
> - [Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
> 
> Note: Apps Script API requires OAuth consent screen configuration even for service accounts.

3. **Create Service Account**:

- Go to "IAM & Admin" > "Service Accounts" > "Create Service Account".
- Name it (e.g., `github-deployer`).
- Grant it the role **Editor** (or more granular permissions if preferred).
- Create a JSON Key for this account and download it.

> 🟡 **ANNOTATION - Security Best Practices**:
> 
> **Editor role is overly permissive** for this use case. According to [Google Cloud IAM best practices](https://cloud.google.com/iam/docs/best-practices):
> 
> Recommended minimal roles:
> - "Service Account Token Creator" (if using domain-wide delegation)
> - Or custom role with only:
>   - `drive.files.create`
>   - `drive.files.copy`
>   - `drive.permissions.create`
>   - `script.projects.create`
>   - `script.projects.updateContent`
> 
> **Additional Security Requirements**:
> - Enable domain-wide delegation for the service account
> - See: https://developers.google.com/apps-script/api/how-tos/service-accounts
> - Required scopes:
>   - `https://www.googleapis.com/auth/drive`
>   - `https://www.googleapis.com/auth/script.projects`
>   - `https://www.googleapis.com/auth/spreadsheets`

4. **Share Drive Folder**:

- Open your "Assessment Bot Public Templates" folder in Google Drive.
- Share it with the `client_email` address found in your Service Account JSON file (give "Editor" access).

> 🟡 **ANNOTATION**: 
> - Sharing with Service Account email gives it access to CREATE files in folder
> - But created files will be OWNED by the Service Account
> - Files won't be publicly accessible by default
> - You'll need to add a sharing step in the automation to make files public or share with specific users
> - Use `drive.permissions.create` to set sharing after file creation

5. **GitHub Secrets**:

- In your GitHub Repo, go to **Settings > Secrets and variables > Actions**.
- Create a secret named `GCP_SA_KEY` and paste the entire JSON key content.
- Create variables/secrets for your **Parent Folder ID** (where releases go) and **Template File IDs** (the clean sheets to copy).

> 🟢 **ANNOTATION - Secret vs Variable**:
> 
> - `GCP_SA_KEY`: Correct as a **secret** (sensitive)
> - `DRIVE_PARENT_FOLDER_ID`: Should be a **variable** (not sensitive)
> - `ADMIN_TEMPLATE_ID`: Should be a **variable** (not sensitive)
> - `RECORD_TEMPLATE_ID`: Should be a **variable** (not sensitive)
> 
> Variables are set at: Settings > Secrets and variables > Actions > Variables tab
> 
> 🔴 **CRITICAL**: Template IDs should be from templates WITH bound scripts (see architecture issue above), NOT "clean templates without scripts"

---

#### **2. The Automation Script (`release.js`)**

Create a script in your repo (e.g., `scripts/release.js`) to handle the logic. This replaces the manual steps 1–6.

_Prerequisites_: `npm install googleapis`

> 🟡 **ANNOTATION**: 
> - Should add googleapis to package.json as a dependency, not install separately
> - Need to specify version: `npm install googleapis@latest` or pin a specific version
> - Current package.json already has @google/clasp and @google/gemini-cli as dependencies

```javascript
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Configuration
const VERSION_TAG = process.env.GITHUB_REF_NAME; // e.g., 'v1.0.0'
const PARENT_FOLDER_ID = process.env.DRIVE_PARENT_FOLDER_ID;
const ADMIN_TEMPLATE_ID = process.env.ADMIN_TEMPLATE_ID;
const RECORD_TEMPLATE_ID = process.env.RECORD_TEMPLATE_ID;

> 🟡 **ANNOTATION - Missing Validation**:
> ```javascript
> // Should add validation:
> const required = {
>   VERSION_TAG,
>   PARENT_FOLDER_ID,
>   ADMIN_TEMPLATE_ID,
>   RECORD_TEMPLATE_ID,
>   GCP_SA_KEY: process.env.GCP_SA_KEY
> };
> for (const [key, value] of Object.entries(required)) {
>   if (!value) {
>     throw new Error(`Missing required environment variable: ${key}`);
>   }
> }
> ```

// Auth
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GCP_SA_KEY),
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/script.projects',
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

> 🟢 **ANNOTATION - Auth Scope**:
> These scopes are correct for the operations described. However, if using domain-wide delegation, you'll need to configure these scopes in the Google Workspace Admin Console as well.

const drive = google.drive({ version: 'v3', auth });
const script = google.script({ version: 'v1', auth });

async function main() {
  console.log(`Starting release for ${VERSION_TAG}...`);

  // 1. Create Release Folder
  const folderMetadata = {
    name: VERSION_TAG,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [PARENT_FOLDER_ID],
  };
  const folder = await drive.files.create({ resource: folderMetadata, fields: 'id' });
  const folderId = folder.data.id;
  console.log(`Created folder: ${folderId}`);

> 🟡 **ANNOTATION - Missing Sharing**:
> ```javascript
> // After creating folder, make it publicly readable:
> await drive.permissions.create({
>   fileId: folderId,
>   resource: {
>     role: 'reader',
>     type: 'anyone'
>   }
> });
> console.log(`Made folder public: ${folderId}`);
> ```

  // 2. Copy Sheets (Clean Templates)
  const adminSheetId = await copyFile(ADMIN_TEMPLATE_ID, `Admin Sheet ${VERSION_TAG}`, folderId);
  const recordSheetId = await copyFile(
    RECORD_TEMPLATE_ID,
    `Assessment Record Template ${VERSION_TAG}`,
    folderId
  );

> 🟢 **ANNOTATION**: copyFile implementation should also handle making files publicly readable (see annotation on copyFile function below)

  // 3. Create Bound Scripts & Push Code
  // Note: You need to map which local files go to which sheet
  const adminScriptId = await createAndPushScript(adminSheetId, 'AdminSheet', 'src/AdminSheet');
  const recordScriptId = await createAndPushScript(
    recordSheetId,
    'AssessmentRecord',
    'src/AssessmentRecordTemplate'
  );

> 🔴 **CRITICAL ISSUE**: This will NOT work as written (see architecture section above). The createAndPushScript function cannot create a bound script via API.
> 
> If using templates WITH bound scripts, you'd need:
> ```javascript
> // 3. Get Script IDs from copied sheets and push code
> const adminScriptId = await getScriptIdForContainer(adminSheetId);
> const recordScriptId = await getScriptIdForContainer(recordSheetId);
> 
> await pushScriptContent(adminScriptId, 'src/AdminSheet');
> await pushScriptContent(recordScriptId, 'src/AssessmentRecordTemplate');
> ```
> 
> Where getScriptIdForContainer would need to:
> 1. List all projects using script.projects.list
> 2. Find project where metadata.parentId matches the sheet ID
> 3. This is fragile and may have race conditions

  // 4. Update AssessmentBotVersions.json
  const versionsPath = 'src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json';
  const versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));

  // Update logic (customize based on your JSON structure)
  versions[VERSION_TAG] = {
    adminSheetId,
    recordSheetId,
    adminScriptId,
    recordScriptId,
  };

> 🔴 **CRITICAL ISSUE - Wrong JSON Structure**:
> 
> Current assessmentBotVersions.json structure is:
> ```json
> {
>   "0.7.6": {
>     "assessmentRecordTemplateFileId": "10O40rCSjMjxwI1LCNYjDuwT8XR3r1qE0HM4ZIF8kQLk",
>     "adminSheetFileId": "1TNMIvhiCy382XnpPS0qZZQyLQ4s86ElYG4dKgH_5BpI"
>   }
> }
> ```
> 
> Should be:
> ```javascript
> versions[VERSION_TAG] = {
>   assessmentRecordTemplateFileId: recordSheetId,
>   adminSheetFileId: adminSheetId
> };
> // Note: No script IDs are stored in current format
> ```
> 
> If you want to add script IDs, need to:
> 1. Update all code that reads this file
> 2. Migrate existing entries
> 3. Document the schema change

  fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2));
  console.log('Updated AssessmentBotVersions.json');

> 🟢 **ANNOTATION**: Should add newline at end of file to match existing format:
> ```javascript
> fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + '\n');
> ```

  // Optional: Update clasp.json files if you want to keep them in sync,
  // though they aren't strictly needed for this automated flow.

> 🟡 **ANNOTATION**: clasp.json files don't currently exist in the repo. This comment is misleading. Either:
> - Remove this comment
> - Or create clasp.json files as part of automation for future manual use
> - Or clarify what "in sync" means
}

async function copyFile(fileId, name, parentId) {
  const res = await drive.files.copy({
    fileId,
    resource: { name, parents: [parentId] },
    fields: 'id',
  });
  console.log(`Copied ${name} -> ${res.data.id}`);
  return res.data.id;
}

> 🟡 **ANNOTATION - Add Error Handling and Sharing**:
> ```javascript
> async function copyFile(fileId, name, parentId) {
>   try {
>     const res = await drive.files.copy({
>       fileId,
>       resource: { name, parents: [parentId] },
>       fields: 'id,webViewLink',
>     });
>     console.log(`Copied ${name} -> ${res.data.id}`);
>     
>     // Make file publicly readable
>     await drive.permissions.create({
>       fileId: res.data.id,
>       resource: {
>         role: 'reader',
>         type: 'anyone'
>       }
>     });
>     console.log(`Made ${name} public`);
>     
>     return res.data.id;
>   } catch (error) {
>     console.error(`Failed to copy ${name}:`, error.message);
>     throw error;
>   }
> }
> ```

async function createAndPushScript(parentId, title, localSrcDir) {
  // Create Project bound to the Sheet
  const createRes = await script.projects.create({
    resource: { title, parentId },
  });
  const scriptId = createRes.data.scriptId;
  console.log(`Created script ${scriptId} for sheet ${parentId}`);

> 🔴 **CRITICAL ISSUE**: This does NOT create a bound script! According to [Apps Script API docs](https://developers.google.com/apps-script/api/reference/rest/v1/projects/create):
> 
> - The `parentId` parameter is for the **parent resource** (organizational folder)
> - It does NOT bind the script to a container document
> - This creates a **standalone** script, not a bound script
> - Bound scripts cannot be created via API
> 
> **This function will fail or create the wrong type of script.**
> 
> Correct approach (if templates have bound scripts):
> ```javascript
> async function getScriptIdForContainer(containerId) {
>   // List all projects
>   const response = await script.projects.list({ pageSize: 100 });
>   
>   // Find project bound to this container
>   // Note: This is fragile and may not work immediately after copy
>   const project = response.data.projects?.find(p => 
>     p.parentId === containerId
>   );
>   
>   if (!project) {
>     throw new Error(`No script found for container ${containerId}`);
>   }
>   
>   return project.scriptId;
> }
> 
> async function pushScriptContent(scriptId, localSrcDir) {
>   const files = await collectScriptFiles(localSrcDir);
>   
>   await script.projects.updateContent({
>     scriptId,
>     resource: { files },
>   });
>   
>   console.log(`Pushed ${files.length} files to ${scriptId}`);
> }
> ```

  // Read local files
  const files = [];
  // You need a helper here to read all .js/.ts files from localSrcDir
  // and format them for the API ({ name, type: 'SERVER_JS', source }).
  // Don't forget appsscript.json!

> 🔴 **CRITICAL ISSUE - Missing Implementation**:
> 
> This is a placeholder comment, not actual code. Need full implementation:
> 
> ```javascript
> async function collectScriptFiles(localSrcDir) {
>   const files = [];
>   
>   // Add appsscript.json
>   const manifestPath = path.join(localSrcDir, 'appsscript.json');
>   const manifest = fs.readFileSync(manifestPath, 'utf8');
>   files.push({ 
>     name: 'appsscript', 
>     type: 'JSON', 
>     source: manifest 
>   });
>   
>   // Collect all .js files, preserving load order
>   const jsFiles = await collectJavaScriptFiles(localSrcDir);
>   
>   // Sort by numeric prefix to preserve load order
>   jsFiles.sort((a, b) => {
>     const aNum = a.match(/^(\d+)/)?.[1] || '999';
>     const bNum = b.match(/^(\d+)/)?.[1] || '999';
>     return aNum.localeCompare(bNum);
>   });
>   
>   for (const filePath of jsFiles) {
>     const source = fs.readFileSync(filePath, 'utf8');
>     const relativePath = path.relative(localSrcDir, filePath);
>     // Apps Script uses flat namespace, so convert path to name
>     const name = relativePath.replace(/\//g, '_').replace(/\.js$/, '');
>     
>     files.push({
>       name,
>       type: 'SERVER_JS',
>       source
>     });
>   }
>   
>   // Collect HTML files
>   const htmlFiles = await collectFiles(localSrcDir, '.html');
>   for (const filePath of htmlFiles) {
>     const source = fs.readFileSync(filePath, 'utf8');
>     const name = path.basename(filePath, '.html');
>     files.push({
>       name,
>       type: 'HTML',
>       source
>     });
>   }
>   
>   return files;
> }
> 
> async function collectJavaScriptFiles(dir) {
>   const files = [];
>   const entries = fs.readdirSync(dir, { withFileTypes: true });
>   
>   for (const entry of entries) {
>     const fullPath = path.join(dir, entry.name);
>     
>     if (entry.isDirectory()) {
>       // Recursively collect from subdirectories
>       files.push(...await collectJavaScriptFiles(fullPath));
>     } else if (entry.name.endsWith('.js')) {
>       files.push(fullPath);
>     }
>   }
>   
>   return files;
> }
> ```
> 
> 🟡 **IMPORTANT**: This flattens directory structure because Apps Script has a flat namespace. File naming must avoid collisions. Current approach uses underscore-separated paths, but test thoroughly.

  // Example (simplified):
  const manifest = fs.readFileSync(path.join(localSrcDir, 'appsscript.json'), 'utf8');
  files.push({ name: 'appsscript', type: 'JSON', source: manifest });

  // ... Loop through your .gs/.js files ...

> 🟡 **ANNOTATION**: Example is incomplete and misleading. See full implementation above.

  // Push content
  await script.projects.updateContent({
    scriptId,
    resource: { files },
  });
  console.log(`Pushed code to ${scriptId}`);
  return scriptId;
}

main().catch(console.error);

> 🟡 **ANNOTATION - Better Error Handling**:
> ```javascript
> main()
>   .then(() => {
>     console.log('Release automation completed successfully');
>     process.exit(0);
>   })
>   .catch(error => {
>     console.error('Release automation failed:', error);
>     process.exit(1);
>   });
> ```
```

---

#### **3. GitHub Actions Workflow (`.github/workflows/deploy.yml`)**

```yaml
name: Deploy Release

on:
  push:
    tags:
      - 'v*' # Triggers on tags like v1.0.0

> 🟢 **ANNOTATION**: Consider also filtering by tag pattern to avoid accidental triggers:
> ```yaml
> - 'v[0-9]+.[0-9]+.[0-9]+' # Only semver tags
> ```

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write # Needed to commit changes and create releases

> 🟡 **ANNOTATION**: If creating a PR instead of direct push, also need:
> ```yaml
> permissions:
>   contents: write
>   pull-requests: write
> ```

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

> 🟡 **ANNOTATION**: When triggered by a tag, this checks out in detached HEAD state. If you need to commit back, should checkout the branch:
> ```yaml
> - name: Checkout Code
>   uses: actions/checkout@v4
>   with:
>     ref: main  # Or determine target branch dynamically
>     fetch-depth: 0  # Needed for git history
> ```

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

> 🟢 **ANNOTATION**: Consider using node-version from package.json if you add an "engines" field, or use a matrix to test multiple versions.

      - name: Install Dependencies
        run: npm install googleapis

> 🟡 **ANNOTATION**: Should install all dependencies:
> ```yaml
> - name: Install Dependencies
>   run: npm ci  # Faster and more reliable than npm install
> ```
> 
> Then add googleapis to package.json beforehand, or keep this separate install if you don't want it as a production dependency.

      - name: Run Deployment Script
        env:
          GCP_SA_KEY: ${{ secrets.GCP_SA_KEY }}
          DRIVE_PARENT_FOLDER_ID: ${{ vars.DRIVE_PARENT_FOLDER_ID }}
          ADMIN_TEMPLATE_ID: ${{ vars.ADMIN_TEMPLATE_ID }}
          RECORD_TEMPLATE_ID: ${{ vars.RECORD_TEMPLATE_ID }}
        run: node scripts/release.js

> 🟢 **ANNOTATION**: Should capture output for use in later steps:
> ```yaml
> - name: Run Deployment Script
>   id: deploy
>   env:
>     GCP_SA_KEY: ${{ secrets.GCP_SA_KEY }}
>     DRIVE_PARENT_FOLDER_ID: ${{ vars.DRIVE_PARENT_FOLDER_ID }}
>     ADMIN_TEMPLATE_ID: ${{ vars.ADMIN_TEMPLATE_ID }}
>     RECORD_TEMPLATE_ID: ${{ vars.RECORD_TEMPLATE_ID }}
>   run: node scripts/release.js
> ```
> 
> And modify release.js to output to GITHUB_OUTPUT:
> ```javascript
> // In release.js after creating folder:
> const outputFile = process.env.GITHUB_OUTPUT;
> if (outputFile) {
>   fs.appendFileSync(outputFile, `folder_id=${folderId}\n`);
>   fs.appendFileSync(outputFile, `admin_sheet_id=${adminSheetId}\n`);
>   fs.appendFileSync(outputFile, `record_sheet_id=${recordSheetId}\n`);
> }
> ```

      - name: Commit Updated Version File
        run: |
          git config --global user.name "GitHub Actions"
          git config --global user.email "actions@github.com"
          git add src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json
          git commit -m "chore: update version references for ${{ github.ref_name }}"
          git push origin HEAD:main 
          # Note: Pushing to main from a tag trigger can be tricky; 
          # you might prefer opening a PR or pushing to a specific branch.

> 🔴 **CRITICAL ISSUE - Git Push from Tag Won't Work**:
> 
> When workflow is triggered by a tag push:
> 1. Checkout is in detached HEAD state
> 2. `HEAD:main` won't work because HEAD is not on a branch
> 3. This will fail with: "You are not currently on a branch"
> 
> **Solutions**:
> 
> **Option A - Create Pull Request (Recommended)**:
> ```yaml
> - name: Create Pull Request with Version Update
>   uses: peter-evans/create-pull-request@v5
>   with:
>     token: ${{ secrets.GITHUB_TOKEN }}
>     commit-message: "chore: update version references for ${{ github.ref_name }}"
>     title: "chore: update version references for ${{ github.ref_name }}"
>     body: |
>       Auto-generated PR to update assessmentBotVersions.json for release ${{ github.ref_name }}
>       
>       - Admin Sheet: ${{ steps.deploy.outputs.admin_sheet_id }}
>       - Record Template: ${{ steps.deploy.outputs.record_sheet_id }}
>     branch: release/${{ github.ref_name }}-version-update
>     base: main
> ```
> 
> **Option B - Direct Push to Main**:
> ```yaml
> - name: Checkout main branch
>   uses: actions/checkout@v4
>   with:
>     ref: main
>     token: ${{ secrets.GITHUB_TOKEN }}
> 
> - name: Copy updated version file
>   run: |
>     # Assuming release.js updated the file in workspace
>     git config user.name "GitHub Actions"
>     git config user.email "actions@github.com"
>     git add src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json
>     git commit -m "chore: update version references for ${{ github.ref_name }}"
>     git push origin main
> ```
> 
> **Option C - Update Tag to Include Commit**:
> ```yaml
> - name: Update version file and amend tag
>   run: |
>     git config user.name "GitHub Actions"
>     git config user.email "actions@github.com"
>     git checkout -b temp-${{ github.ref_name }}
>     git add src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json
>     git commit -m "chore: update version references for ${{ github.ref_name }}"
>     git tag -f ${{ github.ref_name }}
>     git push origin temp-${{ github.ref_name }}:main
>     git push --force origin ${{ github.ref_name }}
> ```
> 
> **Recommended**: Option A (PR) is safest and allows review before merging.

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          name: Release ${{ github.ref_name }}
          body: |
            ## Changes in ${{ github.ref_name }}

            [Link to Release Folder in Drive](https://drive.google.com/drive/u/0/folders/${{ env.NEW_FOLDER_ID }})

            *(You can output the new folder ID from your script to GITHUB_ENV to use it here)*

> 🔴 **CRITICAL ISSUE - env.NEW_FOLDER_ID Not Set**:
> 
> The script doesn't set GITHUB_ENV, so this will be empty. Should use GITHUB_OUTPUT instead:
> 
> ```yaml
> - name: Create GitHub Release
>   uses: softprops/action-gh-release@v1
>   with:
>     name: Release ${{ github.ref_name }}
>     body: |
>       ## Changes in ${{ github.ref_name }}
> 
>       ### 🗂 Release Assets
> 
>       - [📁 Release Folder in Drive](https://drive.google.com/drive/u/0/folders/${{ steps.deploy.outputs.folder_id }})
>       - [📊 Admin Sheet ${{ github.ref_name }}](https://docs.google.com/spreadsheets/d/${{ steps.deploy.outputs.admin_sheet_id }})
>       - [📋 Assessment Record Template ${{ github.ref_name }}](https://docs.google.com/spreadsheets/d/${{ steps.deploy.outputs.record_sheet_id }})
> 
>       ### 📝 Release Notes
> 
>       See [v${{ github.ref_name }}_release_notes.md](./docs/releaseNotes/v${{ github.ref_name }}_release_notes.md) for detailed changelog.
> 
>       *(Release notes should be created manually before tagging)*

          files: |
            src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json

> 🟡 **ANNOTATION - Files to Include**:
> 
> Consider also attaching:
> ```yaml
> files: |
>   src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json
>   docs/releaseNotes/v${{ github.ref_name }}_release_notes.md
> ```
> 
> But ensure release notes file exists first (manual step or separate automation)
```

---

### **Summary of Changes to Your Workflow**

| Step  | Old Workflow (Manual)               | New Workflow (Automated)                                                                 |
| ----- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| **1** | Manually create Drive folder        | **Automated** by Node.js script via Drive API.                                           |
| **2** | Manually create Sheets              | **Automated** by Node.js script copying "Clean Templates".                               |

> 🔴 **ANNOTATION**: Should say "copying templates WITH bound scripts" not "Clean Templates" (see critical architecture issue)

| **3** | Update JSON with Sheet IDs          | **Automated** by Node.js script immediately after copy.                                  |
| **4** | Open Editor, rename, get Script IDs | **Automated** by creating the script _via API_ (`projects.create`) which returns the ID. |

> 🔴 **ANNOTATION**: This row is INCORRECT. Cannot create bound scripts via API. Should say:
> "**Semi-automated** by listing projects and matching container IDs (fragile)" or
> "**Manual** - Must open Script Editor once, then automation retrieves script ID"

| **5** | Update `clasp.json`                 | **Automated** (Optional, if you want to keep them updated).                              |

> 🟡 **ANNOTATION**: clasp.json files don't exist in repo. Either remove this row or clarify that they'll be created.

| **6** | `clasp push` code                   | **Automated** by `script.projects.updateContent` API.                                    |
| **7** | Create Release Notes                | **Automated** by GitHub Action using the `gh-release` step.                              |

> 🟡 **ANNOTATION**: This is misleading. The action creates a GitHub Release with boilerplate text, NOT the detailed release notes shown in the v0.7.6 example. Should say:
> "**Semi-automated** - Manual release notes required, GitHub Release created automatically with links to assets"

---

### **Why this is the "Best" way**

- **Reliability**: Removes `clasp` authentication flakiness by using a Service Account.

> 🟡 **ANNOTATION**: True, but introduces new complexity with Service Account setup and domain-wide delegation requirements.

- **Control**: A custom script gives you exact control over file naming, folder structure, and JSON updates which pre-built Actions can't handle.

> 🟢 **ANNOTATION**: Agreed, custom script provides flexibility.

- **Speed**: All API calls happen in parallel or sequence within seconds, rather than minutes of manual clicking.

> 🟡 **ANNOTATION**: Speed benefit assumes all steps work correctly. Given the critical issues identified, especially around bound script creation, the actual time savings may be less than expected if manual intervention is still needed.

---

## 🔴 CRITICAL NEXT STEPS BEFORE IMPLEMENTATION

Before proceeding with this plan, you MUST:

1. **Decide on Template Strategy**:
   - Option A: Templates WITH bound scripts (requires script ID discovery logic)
   - Option B: Keep manual "open Script Editor" step (partial automation)
   - Option C: Redesign architecture to use standalone scripts (major change)

2. **Test Script ID Retrieval**:
   - Manually copy a sheet with bound script
   - Test if script.projects.list can reliably find the new script ID
   - Document timing issues (does it appear immediately?)

3. **Validate Service Account Permissions**:
   - Test creating files in shared folder
   - Test accessing Apps Script API
   - Confirm domain-wide delegation works (or isn't needed)

4. **Create Missing Implementation**:
   - Complete the collectScriptFiles function
   - Handle directory structure flattening
   - Test with actual AdminSheet (77 files) and AssessmentRecordTemplate (5 files)

5. **Update assessmentBotVersions.json Schema**:
   - Decide if script IDs should be stored
   - Update all code that reads this file
   - Migrate existing entries if schema changes

6. **Clarify Release Notes Process**:
   - Should detailed notes be manual or auto-generated?
   - If manual, at what point in the workflow are they created?
   - How to ensure notes exist before automation runs?

7. **Test Git Push Strategy**:
   - Confirm which approach (PR vs direct push) is preferred
   - Test that it works from tag-triggered workflow

---

## 📚 REFERENCE DOCUMENTATION CONSULTED

### Google Cloud & APIs
- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Service Account Best Practices](https://cloud.google.com/iam/docs/best-practices)
- [Apps Script API Overview](https://developers.google.com/apps-script/api/how-tos/execute)
- [Apps Script API - Service Accounts](https://developers.google.com/apps-script/api/how-tos/service-accounts)
- [Apps Script API - projects.create](https://developers.google.com/apps-script/api/reference/rest/v1/projects/create)
- [Apps Script API - projects.updateContent](https://developers.google.com/apps-script/api/reference/rest/v1/projects/updateContent)
- [Drive API - files.copy](https://developers.google.com/drive/api/v3/reference/files/copy)
- [Drive API - files.create](https://developers.google.com/drive/api/v3/reference/files/create)
- [Drive API - permissions.create](https://developers.google.com/drive/api/v3/reference/permissions/create)

### GitHub Actions
- [GitHub Actions - Triggering on Tags](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#push)
- [GitHub Actions - GITHUB_OUTPUT](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-output-parameter)
- [GitHub Actions - Permissions](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions)
- [softprops/action-gh-release](https://github.com/softprops/action-gh-release)
- [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request)

### Repository-Specific
- Current assessmentBotVersions.json structure
- v0.7.6 release notes example
- AdminSheet file structure (77 files across subdirectories)
- AssessmentRecordTemplate file structure (5 files)
- Numeric prefix naming convention for load order

---

## ✅ RECOMMENDED REVISED APPROACH

Given the critical issues identified, here's a workable alternative approach:

### Phase 1: Partial Automation (Recommended First Step)

1. **Manual Steps** (unavoidable):
   - Create release folder in Drive
   - Copy template sheets (with bound scripts)
   - Open Script Editor for each sheet once (creates bound script containers)

2. **Automated Steps**:
   - GitHub Action triggered by tag
   - Use Drive API to get sheet IDs
   - Use Apps Script API to find script IDs (via container matching)
   - Push code via script.projects.updateContent
   - Update assessmentBotVersions.json
   - Create GitHub Release with links
   - Open PR with version file update

3. **Manual Review**:
   - Review and merge PR
   - Create detailed release notes
   - Verify deployment

### Phase 2: Full Automation (After Phase 1 is Stable)

Only proceed if Phase 1 proves reliable and time-saving:

1. Investigate Drive API automation for folder/sheet creation
2. Research container-to-script-ID mapping reliability
3. Consider using Google Apps Script Web App as orchestrator
4. Add release note generation from conventional commits

### Alternative: Script-First Approach

Instead of trying to automate bound script creation:

1. Create standalone Apps Script project in Drive
2. Deploy as web app or library
3. Sheets reference the standalone script (not bound)
4. Automation only needs to update one standalone script
5. Templates remain simple sheets without scripts

This is a significant architecture change but may be more automation-friendly.

---

## 🎯 IMMEDIATE ACTION ITEMS

Before writing any code:

- [ ] Choose template strategy (with or without bound scripts)
- [ ] Test script ID retrieval manually
- [ ] Set up Service Account with correct permissions
- [ ] Test domain-wide delegation (if needed)
- [ ] Decide on git workflow (PR vs direct push)
- [ ] Clarify release notes process
- [ ] Update assessmentBotVersions.json schema (if adding script IDs)
- [ ] Implement and test file collection logic locally
- [ ] Decide between phased approach or full automation

Do not proceed with implementation until these decisions are made and tested manually.
