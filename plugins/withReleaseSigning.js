// Signs release APKs with a stable keystore when FOODLOG_KEYSTORE_* environment variables are set
// (the GitHub Actions build provides them from repository secrets). A stable key lets each new APK
// install over the previous one without wiping your data. Without the variables, the build falls back
// to the debug key, which is fine for a one-off install but can't be upgraded by a later build.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            if (System.getenv('FOODLOG_KEYSTORE_PATH')) {
                storeFile file(System.getenv('FOODLOG_KEYSTORE_PATH'))
                storeType 'pkcs12'
                storePassword System.getenv('FOODLOG_KEYSTORE_PASSWORD')
                keyAlias System.getenv('FOODLOG_KEY_ALIAS')
                keyPassword System.getenv('FOODLOG_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes('FOODLOG_KEYSTORE_PATH')) return cfg;

    const releaseBuildType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!releaseBuildType.test(src) || !/signingConfigs\s*\{/.test(src)) {
      throw new Error('withReleaseSigning: unexpected android/app/build.gradle layout');
    }
    src = src.replace(
      releaseBuildType,
      "$1signingConfig System.getenv('FOODLOG_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug",
    );
    src = src.replace(/signingConfigs\s*\{/, (m) => m + RELEASE_CONFIG);
    cfg.modResults.contents = src;
    return cfg;
  });
};
