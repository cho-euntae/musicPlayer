/**
 * Expo config plugin: Debug variant에도 JS 번들을 박아 Metro 없이도 단독 실행되도록.
 *
 * 기본 RN/Expo 설정은 `debuggableVariants = ["debug"]` 와 동치라서 debug APK에는
 * index.android.bundle 이 들어가지 않는다. 결과: 폰에 debug APK 설치만 하고
 * Metro 서버 없이 실행하면 "Unable to load script. Make sure ... bundle
 * 'index.android.bundle' is packaged correctly for release." 로 영원히 스플래시
 * 에서 멈춘다.
 *
 * 우리는 보통 폰에 설치해서 단독 테스트하므로, 모든 variant에 번들이 박히도록
 * `react { debuggableVariants = [] }` 를 강제 주입한다.
 *
 * `npx expo prebuild --clean` 후에도 자동으로 다시 적용되도록 plugin 형태로
 * 작성. app.json plugins 배열에 './plugins/with-bundle-in-debug' 를 등록하면
 * prebuild 시 android/app/build.gradle 의 react { } 블록에 한 줄 삽입한다.
 *
 * Metro 서버를 띄워 hot reload를 쓰고 싶을 땐 이 플러그인을 잠시 비활성화하거나,
 * 환경변수 ETMUSIC_KEEP_METRO=1 로 설정하고 prebuild 하면 된다.
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

const SENTINEL = '/* expo:bundle-in-debug */';
// react { } 블록 끝부분(autolinkLibrariesWithApp() 직전)에 끼워 넣을 라인.
const INJECT_LINE = `    ${SENTINEL}\n    debuggableVariants = []`;

/**
 * @param {string} contents
 * @returns {string}
 */
function injectDebuggableVariants(contents) {
  if (contents.includes(SENTINEL)) {
    return contents;
  }

  // `react { ... autolinkLibrariesWithApp() ... }` 블록에서
  // autolinkLibrariesWithApp() 호출 라인 바로 앞에 우리 라인을 끼운다.
  const anchor = /(\n\s*autolinkLibrariesWithApp\(\))/;
  if (!anchor.test(contents)) {
    // 앵커가 없으면 그냥 react { ... } 블록의 마지막 } 직전에 삽입한다.
    const reactBlockEnd = /(\nreact \{[\s\S]*?\n)(\})/;
    if (!reactBlockEnd.test(contents)) {
      // 매칭 실패 시 안전하게 원본 반환 — 빌드를 깨지 않도록.
      return contents;
    }
    return contents.replace(reactBlockEnd, `$1${INJECT_LINE}\n$2`);
  }
  return contents.replace(anchor, `\n${INJECT_LINE}$1`);
}

module.exports = function withBundleInDebug(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      return mod;
    }
    mod.modResults.contents = injectDebuggableVariants(mod.modResults.contents);
    return mod;
  });
};
