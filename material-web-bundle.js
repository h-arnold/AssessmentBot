/**
 * Material Web Components Bundle
 * This file imports only the Material Web components needed for this project.
 */

// Import the specific components we need based on the current HTML files
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/textfield/filled-text-field.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/filled-select.js';
import '@material/web/select/select-option.js';
import '@material/web/tabs/tabs.js';
import '@material/web/tabs/primary-tab.js';
import '@material/web/progress/linear-progress.js';
import '@material/web/dialog/dialog.js';
import '@material/web/icon/icon.js';
import '@material/web/checkbox/checkbox.js';

// Export for global use if needed
window.MaterialWeb = {
  // Any additional utilities can be added here
};