# 📝 Assessment Bot Configuration Options

- [📝 Assessment Bot Configuration Options](#-assessment-bot-configuration-options)
  - [📂 Where to Find the Settings](#-where-to-find-the-settings)
  - [⚙️ The Options](#️-the-options)
    - [🌐 Backend Tab](#-backend-tab)
      - [🔑 API Key](#-api-key)
      - [🌍 URL](#-url)
  - [🧩 Advanced Options Tab](#-advanced-options-tab)
    - [📦 Batch Size](#-batch-size)
    - [🔗 Update Details URL](#-update-details-url)
    - [🗂️ Assessment Record Template ID](#️-assessment-record-template-id)
    - [📁 Assessment Record Destination Folder](#-assessment-record-destination-folder)
    - [⏳ Days Until Auth Revoke](#-days-until-auth-revoke)
  - [🐞 Debug Tab](#-debug-tab)
    - [🏫 Classroom](#-classroom)

## 📂 Where to Find the Settings

1. Open your **Admin sheet**.
2. Click **Assessment Bot** -> **Settings**.

## ⚙️ The Options

### 🌐 Backend Tab

**Important:** The two Backend settings are _required_ for Assessment Bot to function.

#### 🔑 API Key

This authenticates you with the Assessment Bot backend, which you should have set up already. It is the same API key you set in the `API_KEYS` environment variable when deploying the backend.

#### 🌍 URL

This is the URL of your deployed Assessment Bot backend. It should look something like:
`https://assessment-bot-backend.yourdomain.com/v1/assessor`

---

## 🧩 Advanced Options Tab

These configuration values are _optional_, but you may wish to adjust them depending on your preferences.

### 📦 Batch Size

**Default:** 20

This is the number of simultaneous requests Assessment Bot will make to the Langflow backend. For my [Google Cloud Run configuration of Langflow](./langflowDeployment/langflowDeployment.md), a batch size of **20** offers the best balance between speed and avoiding timeouts.

### 🔗 Update Details URL

**Default:**  
 `https://raw.githubusercontent.com/h-arnold/AssessmentBot/refs/heads/main/src/frontend/UpdateManager/assessmentBotVersions.json`

This URL points to a JSON file that contains the Google Drive File IDs of the template admin and assessment record sheets.  
When you update or run Assessment Bot for the first time, it will copy the files found at these File IDs.  
If you're using a custom build of Assessment Bot, update this URL to point to your own file.

### 🗂️ Assessment Record Template ID

**Default:** The File ID of the Assessment Record for your current version (pulled from the **Update Details URL**).

This template is used as the base for all Assessment Records.

### 📁 Assessment Record Destination Folder

**Default:** A folder named **`Assessment Records`** located in the same folder as your **Admin Sheet**.

If you don't specify a folder when first opening the **Admin Sheet**, the script will automatically create the **`Assessment Records`** folder.

### ⏳ Days Until Auth Revoke

**Default:** 60 days

When you update the **Admin Sheet**, its authentication is revoked as the final action before it's archived. Since it's not possible to revoke authentication for scripts outside of the currently running script, a time-based trigger is created for each **Assessment Record** to automatically revoke authentication after the specified number of days. This prevents archived Assessment Records from retaining permissions that could be exploited by malicious actors.

---

## 🐞 Debug Tab

This option allows the **Admin Sheet** to act as an **Assessment Record** for debugging purposes.  
Using this mode enables full use of the **App Script Debugger** for troubleshooting issues.

### 🏫 Classroom

Select the classroom you want the **Admin Sheet** to simulate as an **Assessment Record**.
