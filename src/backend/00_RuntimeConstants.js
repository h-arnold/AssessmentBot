const RuntimeConstants = Object.freeze({
  MINUTES_PER_HOUR: 60,
  SECONDS_PER_MINUTE: 60,
  MS_PER_SECOND: 1000,
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RuntimeConstants,
  };
}
