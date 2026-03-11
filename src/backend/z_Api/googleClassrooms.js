/**
 * Thin transport handler for Google Classroom listing.
 *
 * Section 1 defines the API contract only. Behaviour is added later.
 *
 * @param {object} params
 * @returns {void}
 */
function getGoogleClassrooms(params) {
  throw new Error(
    'getGoogleClassrooms is a Section 1 contract-only handler and is not implemented yet.'
  );
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getGoogleClassrooms,
  };
}
