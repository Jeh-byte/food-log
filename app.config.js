// Extends app.json. CI sets FOODLOG_VERSION_CODE to the build number so every APK can update the last one.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    versionCode: Number(process.env.FOODLOG_VERSION_CODE) || 1,
  },
});
