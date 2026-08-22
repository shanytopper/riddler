// Moves the CMake build tree (.cxx) to the repository root so generated object-file paths stay under
// Windows' 260-character limit. CMake hashes long source paths only while the hashed result still
// fits its 250-character ceiling; with the default tree under apps/mobile/android/app/.cxx the
// release variant (folder "RelWithDebInfo") pushed React Native's autolinked code past it and ninja
// failed with "Filename longer than 260 characters".
const { withAppBuildGradle } = require("expo/config-plugins");

const STAGING_BLOCK = `
    externalNativeBuild {
        cmake {
            // Short CMake build tree; see plugins/withShortNativeBuildDir.js
            buildStagingDirectory = rootProject.file("../../../.cxx")
        }
    }
`;

module.exports = function withShortNativeBuildDir(config) {
  return withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes("buildStagingDirectory")) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /^android \{\r?\n/m,
        (match) => `${match}${STAGING_BLOCK}`,
      );
    }
    return mod;
  });
};
