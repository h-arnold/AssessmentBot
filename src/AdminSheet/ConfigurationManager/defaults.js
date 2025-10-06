/**
 * Default configuration values for ConfigurationManager.
 */

const DEFAULTS = Object.freeze({
  BACKEND_ASSESSOR_BATCH_SIZE: 200,
  SLIDES_FETCH_BATCH_SIZE: 30,
  DAYS_UNTIL_AUTH_REVOKE: 60,
  UPDATE_DETAILS_URL:
    'https://raw.githubusercontent.com/h-arnold/AssessmentBot/refs/heads/main/src/AdminSheet/UpdateAndInitManager/assessmentBotVersions.json',
  UPDATE_STAGE: 0,
  JSON_DB_MASTER_INDEX_KEY: 'ASSESSMENT_BOT_DB_MASTER_INDEX',
  JSON_DB_AUTO_CREATE_COLLECTIONS: true,
  JSON_DB_LOCK_TIMEOUT_MS: 10000,
  JSON_DB_LOG_LEVEL: 'INFO',
  JSON_DB_BACKUP_ON_INITIALISE: false,
  JSON_DB_ROOT_FOLDER_ID: null,
});

module.exports = { DEFAULTS };
