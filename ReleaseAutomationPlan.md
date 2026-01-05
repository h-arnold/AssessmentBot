# Release Automation Plan

## Current Manual Workflow

At present, the (manual) workflow goes like so:

1. Create a new folder in this public Google Drive folder with matching the release tag name: Assessment Bot Public Templates - Google Drive

2. Create two new Google Sheets in that folder called Admin Sheet {release tag} and Assessment Record Template {release tag}. Example here: https://drive.google.com/drive/folders/1xk7wQEX8jLKa0sKhBdkrSA7WJUucpPhv?usp=sharing

3. Update `AssessmentBotVersions.json` with the fileIds of the newly created sheets. Link to the file here: https://github.com/h-arnold/AssessmentBot/blob/main/src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json

4. Open up the GAS App Script Editor for each Google Sheet, rename the App Script project to match the Google Sheets File and get the script ids.

5. Put the scripts IDs into the relevant clasp.json files in the AdminSheet and AssessmentRecordTemplate folders.

6. Push the code relevant pieces of code to the correct scripts.

7. Create release notes which detail the changes and link to the new file. Example here: https://raw.githubusercontent.com/h-arnold/AssessmentBot/refs/heads/main/docs/releaseNotes/v0.7.6_release_notes.md

### **The Architecture**

1. **Authentication**: Use a Google Cloud Service Account (SA). You will share your "Assessment Bot Public Templates" Drive folder with this SA's email address so it can create files there.
2. **Templates**: Maintain "Clean Templates" (Google Sheets with layout/formatting but **no bound scripts**) in your Drive. This is crucial because it allows the automation to:

- Copy the sheet (getting the new Sheet ID).
- Create a _new_ bound script project on that sheet (immediately getting the new Script ID).
- Push the code.
- _Note: If you copy a sheet that already has a script, retrieving the new script's ID programmatically is difficult and unreliable._

3. **Workflow Trigger**: The GitHub Action runs when you push a new tag (e.g., `v1.0.0`).

---

### **Step-by-Step Implementation**

#### **1. Google Cloud Setup (One-time)**

1. **Create a GCP Project**: Go to the Google Cloud Console and create a project (e.g., `assessment-bot-deploy`).
2. **Enable APIs**: Enable the following APIs for this project:

- **Google Drive API**
- **Google Apps Script API**
- **Google Sheets API**

3. **Create Service Account**:

- Go to "IAM & Admin" > "Service Accounts" > "Create Service Account".
- Name it (e.g., `github-deployer`).
- Grant it the role **Editor** (or more granular permissions if preferred).
- Create a JSON Key for this account and download it.

4. **Share Drive Folder**:

- Open your "Assessment Bot Public Templates" folder in Google Drive.
- Share it with the `client_email` address found in your Service Account JSON file (give "Editor" access).

5. **GitHub Secrets**:

- In your GitHub Repo, go to **Settings > Secrets and variables > Actions**.
- Create a secret named `GCP_SA_KEY` and paste the entire JSON key content.
- Create variables/secrets for your **Parent Folder ID** (where releases go) and **Template File IDs** (the clean sheets to copy).

#### **2. The Automation Script (`release.js`)**

Create a script in your repo (e.g., `scripts/release.js`) to handle the logic. This replaces the manual steps 1–6.

_Prerequisites_: `npm install googleapis`

```javascript
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Configuration
const VERSION_TAG = process.env.GITHUB_REF_NAME; // e.g., 'v1.0.0'
const PARENT_FOLDER_ID = process.env.DRIVE_PARENT_FOLDER_ID;
const ADMIN_TEMPLATE_ID = process.env.ADMIN_TEMPLATE_ID;
const RECORD_TEMPLATE_ID = process.env.RECORD_TEMPLATE_ID;

// Auth
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GCP_SA_KEY),
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/script.projects',
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

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

  // 2. Copy Sheets (Clean Templates)
  const adminSheetId = await copyFile(ADMIN_TEMPLATE_ID, `Admin Sheet ${VERSION_TAG}`, folderId);
  const recordSheetId = await copyFile(
    RECORD_TEMPLATE_ID,
    `Assessment Record Template ${VERSION_TAG}`,
    folderId
  );

  // 3. Create Bound Scripts & Push Code
  // Note: You need to map which local files go to which sheet
  const adminScriptId = await createAndPushScript(adminSheetId, 'AdminSheet', 'src/AdminSheet');
  const recordScriptId = await createAndPushScript(
    recordSheetId,
    'AssessmentRecord',
    'src/AssessmentRecordTemplate'
  );

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

  fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2));
  console.log('Updated AssessmentBotVersions.json');

  // Optional: Update clasp.json files if you want to keep them in sync,
  // though they aren't strictly needed for this automated flow.
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

async function createAndPushScript(parentId, title, localSrcDir) {
  // Create Project bound to the Sheet
  const createRes = await script.projects.create({
    resource: { title, parentId },
  });
  const scriptId = createRes.data.scriptId;
  console.log(`Created script ${scriptId} for sheet ${parentId}`);

  // Read local files
  const files = [];
  // You need a helper here to read all .js/.ts files from localSrcDir
  // and format them for the API ({ name, type: 'SERVER_JS', source }).
  // Don't forget appsscript.json!

  // Example (simplified):
  const manifest = fs.readFileSync(path.join(localSrcDir, 'appsscript.json'), 'utf8');
  files.push({ name: 'appsscript', type: 'JSON', source: manifest });

  // ... Loop through your .gs/.js files ...

  // Push content
  await script.projects.updateContent({
    scriptId,
    resource: { files },
  });
  console.log(`Pushed code to ${scriptId}`);
  return scriptId;
}

main().catch(console.error);
```

#### **3. GitHub Actions Workflow (`.github/workflows/deploy.yml`)**

```yaml
name: Deploy Release

on:
  push:
    tags:
      - 'v*' # Triggers on tags like v1.0.0

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write # Needed to commit changes and create releases

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Dependencies
        run: npm install googleapis

      - name: Run Deployment Script
        env:
          GCP_SA_KEY: ${{ secrets.GCP_SA_KEY }}
          DRIVE_PARENT_FOLDER_ID: ${{ vars.DRIVE_PARENT_FOLDER_ID }}
          ADMIN_TEMPLATE_ID: ${{ vars.ADMIN_TEMPLATE_ID }}
          RECORD_TEMPLATE_ID: ${{ vars.RECORD_TEMPLATE_ID }}
        run: node scripts/release.js

      - name: Commit Updated Version File
        run: |
          git config --global user.name "GitHub Actions"
          git config --global user.email "actions@github.com"
          git add src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json
          git commit -m "chore: update version references for ${{ github.ref_name }}"
          git push origin HEAD:main 
          # Note: Pushing to main from a tag trigger can be tricky; 
          # you might prefer opening a PR or pushing to a specific branch.

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          name: Release ${{ github.ref_name }}
          body: |
            ## Changes in ${{ github.ref_name }}

            [Link to Release Folder in Drive](https://drive.google.com/drive/u/0/folders/${{ env.NEW_FOLDER_ID }})

            *(You can output the new folder ID from your script to GITHUB_ENV to use it here)*
          files: |
            src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json
```

### **Summary of Changes to Your Workflow**

| Step  | Old Workflow (Manual)               | New Workflow (Automated)                                                                 |
| ----- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| **1** | Manually create Drive folder        | **Automated** by Node.js script via Drive API.                                           |
| **2** | Manually create Sheets              | **Automated** by Node.js script copying "Clean Templates".                               |
| **3** | Update JSON with Sheet IDs          | **Automated** by Node.js script immediately after copy.                                  |
| **4** | Open Editor, rename, get Script IDs | **Automated** by creating the script _via API_ (`projects.create`) which returns the ID. |
| **5** | Update `clasp.json`                 | **Automated** (Optional, if you want to keep them updated).                              |
| **6** | `clasp push` code                   | **Automated** by `script.projects.updateContent` API.                                    |
| **7** | Create Release Notes                | **Automated** by GitHub Action using the `gh-release` step.                              |

### **Why this is the "Best" way**

- **Reliability**: Removes `clasp` authentication flakiness by using a Service Account.
- **Control**: A custom script gives you exact control over file naming, folder structure, and JSON updates which pre-built Actions can't handle.
- **Speed**: All API calls happen in parallel or sequence within seconds, rather than minutes of manual clicking.
