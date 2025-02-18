// This file contains the global functions for the InitController Class.
// Note that initController has been instantiated in singletons.js


function onOpen() {
/**
 * @function onOpen
 * @description This function is triggered when the Google Slides document is opened.
 * It calls the `onOpen` method of the `initController` instance to perform
 * any necessary initialization tasks when the document is opened.
 */
 initController.onOpen();
}


/**
 * @function handleScriptInit
 * @description This function is the entry point for initializing the script.
 * It creates a new instance of the `initController` class and calls its
 * `handleScriptInit` method to start the initialization process.
 * @returns {void}
 */
function handleScriptInit() {
    initController.handleScriptInit();
  }