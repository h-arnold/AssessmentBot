# 🔧 Deploying Langflow Server

These instructions guide you through deploying a Langflow server using Google Cloud Run. Adjustments may be required for different environments.

- [🔧 Deploying Langflow Server](#-deploying-langflow-server)
  - [✨ Prerequisites](#-prerequisites)
    - [▪️ Google Cloud Project](#️-google-cloud-project)
    - [🔑 Google Cloud Service Account](#-google-cloud-service-account)
    - [▪️ PostgreSQL Database](#️-postgresql-database)
  - [🔄 Deployment Steps](#-deployment-steps)
    - [📂 Set Up the Database](#-set-up-the-database)
    - [🔐 Store Your Secrets](#-store-your-secrets)
    - [🚀 Deploy Langflow](#-deploy-langflow)
      - [🖥️ Building the Image and Supplying Environment Variables](#️-building-the-image-and-supplying-environment-variables)
      - [📀 Adding Storage Mounts](#-adding-storage-mounts)
      - [🧩 Mounting Storage Volumes](#-mounting-storage-volumes)
      - [✅ Deploying the Revision](#-deploying-the-revision)
  - [✔️ Verify the Deployment](#️-verify-the-deployment)

---

## ✨ Prerequisites

### ▪️ Google Cloud Project

- An active Google Cloud project with billing enabled.

### 🔑 Google Cloud Service Account

Creating a service account is recommended for security and essential for accessing secrets later.

- Create a service account with these roles:
  - Cloud Run Invoker
  - Secret Manager Secret Accessor
  - Storage Object Viewer (if accessing a GCS bucket)

### ▪️ PostgreSQL Database

- A PostgreSQL database is required. [Supabase](https://supabase.com/) provides free GDPR-compliant PostgreSQL databases hosted in Europe.

---

## 🔄 Deployment Steps

### 📂 Set Up the Database

1. Sign up and create a project in Supabase.
2. Navigate to `Settings` ➡️ `Database`.
3. Set your database password.
4. Enable `Enforce SSL on incoming connections`.
5. Download the SSL certificate.
6. Click `Connect` at the top.
7. Use the URL from the **Direct Connection** option. Replace `[DATABASE PASSWORD]` with your password.

### 🔐 Store Your Secrets

Using Google Secret Manager, create and store:

- Database URL from above.
- SSL certificate from above.
- Langflow superuser password (secure).
- Fernet encryption key ([generate here](https://fernetkeygen.com/)).

### 🚀 Deploy Langflow

Follow these steps carefully after clicking the deployment button.

#### 🖥️ Building the Image and Supplying Environment Variables

1. Click the button below:

[![Run on Google Cloud](https://deploy.cloud.run/button.svg)](https://deploy.cloud.run?git_repo=https://github.com/h-arnold/AssessmentBot&dir=/src/backend/docker)
2. Provide the required environment variables. Use provided defaults where applicable.

#### 📀 Adding Storage Mounts

3. Go to Cloud Run and select your Langflow instance.
4. Click `Edit and Deploy New Revision`.
5. Navigate to the `Volumes` tab and create two volumes:

- **Postgres SSL Cert:**

  - **Volume Type:** Secret
  - **Volume Name:** `postgresSSLCert`
  - **Secret:** Name of your secret (e.g., `postgresSSLCert`)
  - **Path:** `root.crt`

- **Langflow Cache Directory:**

  - **Volume Type:** In-memory
  - **Volume Name:** `cache`
  - **Size Limit:** `512M`

#### 🧩 Mounting Storage Volumes

6. Click the `Container(s)` tab.
7. Find `Volume mounts` and click `+ Mount Volume`:

- **Postgres SSL Cert:**

  - **Mount Path:** `/app/data/.postgres`
  - *(Verify: Should show as **`/app/data/.postgres/root.crt`**)*

- **Langflow Cache Directory:**

  - **Mount Path:** `/app/data/.cache`

#### ✅ Deploying the Revision

8. Scroll down, tick `Service this revision immediately`.
9. Click `Deploy`.

Your Langflow deployment should be live within approximately 30 seconds.

---

## ✔️ Verify the Deployment

On the Cloud Run page, copy and open the URL at the top. If successful, you'll be able to log into your new Langflow instance.