# 📝 Assessment Bot Configuration Options

- [📝 Assessment Bot Configuration Options](#-assessment-bot-configuration-options)
  - [📂 Where to Find the Settings](#-where-to-find-the-settings)
  - [⚙️ The Options](#️-the-options)
    - [🌐 Backend Tab](#-backend-tab)
      - [🔑 API Key](#-api-key)
      - [🌍 URL](#-url)
    - [🧩 Advanced Options Tab](#-advanced-options-tab)
      - [📦 Backend Assessor Batch Size](#-backend-assessor-batch-size)
      - [🖼️ Slides Fetch Batch Size](#-slides-fetch-batch-size)
      - [⏳ Days Until Auth Revoke](#-days-until-auth-revoke)
    - [🗃️ Database Tab](#-database-tab)
      - [🗂️ JSON DB Master Index Key](#-json-db-master-index-key)
      - [⏱️ JSON DB Lock Timeout (ms)](#-json-db-lock-timeout-ms)
      - [📈 JSON DB Log Level](#-json-db-log-level)
      - [💾 JSON DB Backup On Initialise](#-json-db-backup-on-initialise)
      - [📁 JSON DB Root Folder ID](#-json-db-root-folder-id)

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

### 🧩 Advanced Options Tab

These values are optional, but can be tuned for throughput and reliability.

#### 📦 Backend Assessor Batch Size

**Default:** 120

This is the number of student-response requests Assessment Bot sends to the backend in each batch.

#### 🖼️ Slides Fetch Batch Size

**Default:** 30

This is the number of image fetch requests processed in each batch when working with Slides-based tasks.

#### ⏳ Days Until Auth Revoke

**Default:** 60 days

After an assessment record has been created, this value controls when the automatic auth-revocation trigger runs.

---

### 🗃️ Database Tab

These settings control internal JsonDbApp storage behaviour.

#### 🗂️ JSON DB Master Index Key

**Default:** `ASSESSMENT_BOT_DB_MASTER_INDEX`

The script property key used by JsonDbApp to locate the database index.

#### ⏱️ JSON DB Lock Timeout (ms)

**Default:** 15000

Timeout used when acquiring database locks.

#### 📈 JSON DB Log Level

**Default:** `INFO`

Controls JsonDbApp logging verbosity.

#### 💾 JSON DB Backup On Initialise

**Default:** `false`

When enabled, JsonDbApp creates a backup when initialising the database.

#### 📁 JSON DB Root Folder ID

**Default:** empty (unset)

Optional Google Drive folder ID used as the root location for database files.
