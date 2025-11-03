//////////////////////////////////////////////////////////////////////////////////////////////
// configuration.js
// Configuration dialog helpers.
//////////////////////////////////////////////////////////////////////////////////////////////

function openConfigurationDialog() {
  AssessmentBot.showConfigurationDialog();
}

function saveConfiguration(formData) {
  return AssessmentBot.saveConfiguration(formData);
}

function getConfiguration() {
  return AssessmentBot.getConfiguration();
}
