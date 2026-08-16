const { withGradleProperties, withProjectBuildGradle } = require('@expo/config-plugins');

// This plugin runs during `expo prebuild` (wherever it's triggered from —
// GitHub Actions, a local machine, or EAS's own internal copy) and bakes
// these fixes directly into the generated native project, so they can't be
// silently discarded the way manual post-prebuild file edits were.
module.exports = function withGradleFixes(config) {
  // 1. Increase Gradle memory and disable daemon reuse
  config = withGradleProperties(config, (config) => {
    const props = config.modResults;

    const setProp = (key, value) => {
      const existing = props.find((p) => p.type === 'property' && p.key === key);
      if (existing) {
        existing.value = value;
      } else {
        props.push({ type: 'property', key, value });
      }
    };

    setProp('org.gradle.jvmargs', '-Xmx4096m -XX:MaxMetaspaceSize=1536m');
    setProp('org.gradle.workers.max', '1');
    setProp('org.gradle.daemon', 'false');

    return config;
  });

  // 2. Force-disable lintVital tasks across ALL modules, including
  // third-party libraries — this is what was crashing the build with
  // "java.lang.OutOfMemoryError: Metaspace" during
  // react-native-async-storage_async-storage:lintVitalAnalyzeRelease
  // (and would recur on other modules even if that one were fixed alone).
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents += `

allprojects {
    tasks.whenTaskAdded { task ->
        if (task.name.contains("lintVital")) {
            task.enabled = false
        }
    }
}
`;
    }
    return config;
  });

  return config;
};
