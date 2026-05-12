#!/usr/bin/env bash
#
# ET-Music Debug APK 빌드 스크립트.
# 사용자 Mac 터미널에서 실행하세요.
#
# 흐름:
#   1) 환경 점검 (JDK 17+, ANDROID_HOME, npm install 상태)
#   2) expo-audio 같은 새 네이티브 모듈이 추가됐으면 android/ 재생성
#   3) gradle assembleDebug
#   4) 결과 APK 경로 출력
#
# 평균 빌드 시간:
#   - 첫 실행: 5~15분 (gradle 의존성 다운로드 포함)
#   - 캐시된 후: 1~3분
#
# 자세한 트러블슈팅은 BUILD.md 참고.

set -euo pipefail

# 이 스크립트가 위치한 곳을 기준으로 프로젝트 루트 계산.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# 색깔 출력 헬퍼.
green() { printf "\033[32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
red() { printf "\033[31m%s\033[0m\n" "$1"; }

green "==> ET-Music Debug APK 빌드 시작"
echo "프로젝트: $PROJECT_ROOT"
echo ""

# ─── 1. 환경 점검 ────────────────────────────────────────────────────────────
green "==> 1/4 환경 점검"

if ! command -v java >/dev/null 2>&1; then
  red "✗ java 가 PATH에 없습니다. JDK 17 또는 21을 설치하세요."
  echo "  brew install --cask zulu@17"
  exit 1
fi

JAVA_MAJOR="$(java -version 2>&1 | sed -n 's/.*version "\([0-9]*\).*/\1/p' | head -1)"
if [[ -z "$JAVA_MAJOR" ]] || [[ "$JAVA_MAJOR" -lt 17 ]]; then
  red "✗ JDK 17 이상이 필요합니다. (현재: $JAVA_MAJOR)"
  echo "  brew install --cask zulu@17"
  echo "  export JAVA_HOME=\$(/usr/libexec/java_home -v 17)"
  exit 1
fi
echo "✓ Java $JAVA_MAJOR"

if [[ -z "${ANDROID_HOME:-}" ]] && [[ -z "${ANDROID_SDK_ROOT:-}" ]]; then
  # Mac 표준 위치를 자동 탐지.
  if [[ -d "$HOME/Library/Android/sdk" ]]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
    yellow "ⓘ ANDROID_HOME 자동 설정: $ANDROID_HOME"
  else
    red "✗ ANDROID_HOME 이 비어있고 표준 경로도 없습니다."
    echo "  ~/.zshrc 에 다음을 추가하세요:"
    echo "    export ANDROID_HOME=\"\$HOME/Library/Android/sdk\""
    echo "    export PATH=\"\$PATH:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/cmdline-tools/latest/bin\""
    exit 1
  fi
fi
ANDROID_SDK="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
echo "✓ Android SDK: $ANDROID_SDK"

if [[ ! -d node_modules ]]; then
  yellow "ⓘ node_modules 없음 → npm install 실행"
  npm install
fi
echo "✓ node_modules"

echo ""

# ─── 2. 네이티브 모듈 변경 감지 → prebuild ──────────────────────────────────
green "==> 2/4 네이티브 모듈 동기화"

# 환경변수 SKIP_PREBUILD=1 로 스킵 가능.
if [[ "${SKIP_PREBUILD:-0}" == "1" ]]; then
  yellow "ⓘ SKIP_PREBUILD=1 이므로 prebuild 스킵"
else
  # expo-audio 추가 등 새 네이티브 모듈이 있으면 android/ 재생성이 안전.
  # 기존 keystore/local.properties 같은 사용자 파일은 prebuild가 보존하지 않으므로
  # 백업했다가 복원한다.
  KEYSTORE_BACKUP=""
  if ls android/app/*.keystore >/dev/null 2>&1; then
    KEYSTORE_BACKUP="$(mktemp -d)"
    cp android/app/*.keystore "$KEYSTORE_BACKUP/"
    yellow "ⓘ keystore 임시 백업: $KEYSTORE_BACKUP"
  fi
  LOCAL_PROPS_BACKUP=""
  if [[ -f android/local.properties ]]; then
    LOCAL_PROPS_BACKUP="$(mktemp)"
    cp android/local.properties "$LOCAL_PROPS_BACKUP"
  fi

  echo "→ npx expo prebuild --platform android --clean"
  npx expo prebuild --platform android --clean

  # 백업 복원
  if [[ -n "$KEYSTORE_BACKUP" ]]; then
    cp -n "$KEYSTORE_BACKUP"/*.keystore android/app/ || true
    rm -rf "$KEYSTORE_BACKUP"
  fi
  if [[ -n "$LOCAL_PROPS_BACKUP" ]]; then
    cp -n "$LOCAL_PROPS_BACKUP" android/local.properties || true
    rm -f "$LOCAL_PROPS_BACKUP"
  fi
fi

echo ""

# ─── 3. gradle assembleDebug ────────────────────────────────────────────────
green "==> 3/4 gradle assembleDebug (시간이 좀 걸립니다)"

cd android

# local.properties 가 없으면 자동 생성.
if [[ ! -f local.properties ]]; then
  echo "sdk.dir=$ANDROID_SDK" > local.properties
  yellow "ⓘ android/local.properties 자동 생성"
fi

./gradlew assembleDebug

cd "$PROJECT_ROOT"

# ─── 4. 결과 확인 ───────────────────────────────────────────────────────────
green "==> 4/4 결과 확인"

APK_PATH="$PROJECT_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$APK_PATH" ]]; then
  red "✗ APK 파일이 생성되지 않았습니다: $APK_PATH"
  exit 1
fi

APK_SIZE="$(du -h "$APK_PATH" | cut -f1)"
echo ""
green "🎉 빌드 완료!"
echo "  APK 경로: $APK_PATH"
echo "  크기:     $APK_SIZE"
echo ""
echo "다음 단계:"
echo "  핸드폰을 USB로 연결한 뒤 아래 스크립트 실행:"
echo "    bash $PROJECT_ROOT/scripts/install-to-phone.sh"
