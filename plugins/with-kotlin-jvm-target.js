/**
 * Expo config plugin: 모든 subproject의 Kotlin JVM target을 17로 강제 정렬.
 *
 * 일부 라이브러리(예: react-native-image-colors)가 Kotlin compile target을
 * 21로 잡으면서 프로젝트의 Java 17과 충돌하는 문제를 해결한다.
 *
 *   FAILURE: ❌ Inconsistent JVM Target Compatibility Between Java and Kotlin Tasks
 *   Inconsistent JVM-target compatibility detected for tasks
 *   'compileReleaseJavaWithJavac' (17) and 'compileReleaseKotlin' (21).
 *
 * `npx expo prebuild --clean` 후에도 자동으로 다시 적용되도록 plugin 형태로
 * 작성. app.json plugins 배열에 './plugins/with-kotlin-jvm-target'를 등록하면
 * prebuild 시 android/build.gradle에 아래 블록을 자동 삽입한다.
 */
const { withProjectBuildGradle } = require('@expo/config-plugins');

const SENTINEL = '/* expo:kotlin-jvm-target */';
const INJECT = `
  ${SENTINEL}
  tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
    kotlinOptions {
      jvmTarget = "17"
    }
  }
`;

/**
 * @typedef {{ contents: string }} ProjectBuildGradleResults
 * @typedef {{ modResults: ProjectBuildGradleResults }} GradleConfigMod
 */

/**
 * @param {string} contents
 * @returns {string}
 */
function injectKotlinJvmTarget(contents) {
  if (contents.includes(SENTINEL)) {
    return contents;
  }

  // allprojects { ... } 블록의 마지막 } 바로 앞에 우리 task block을 삽입.
  // 정규식으로 첫 매칭의 닫는 중괄호를 찾는다.
  const allprojectsRegex = /allprojects\s*\{[\s\S]*?\n\}/;
  const match = contents.match(allprojectsRegex);
  if (!match) {
    // allprojects 블록이 없으면 파일 끝에 새 블록으로 추가.
    return `${contents}\n\nallprojects {${INJECT}\n}\n`;
  }

  const block = match[0];
  // 마지막 \n} 직전에 INJECT를 끼워넣는다.
  const replaced = block.replace(/\n\}$/, `${INJECT}\n}`);
  return contents.replace(block, replaced);
}

module.exports = function withKotlinJvmTarget(config) {
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      return mod;
    }
    mod.modResults.contents = injectKotlinJvmTarget(mod.modResults.contents);
    return mod;
  });
};
