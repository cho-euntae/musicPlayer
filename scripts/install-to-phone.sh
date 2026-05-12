#!/usr/bin/env bash
#
# 빌드된 ET-Music Debug APK를 USB 연결된 안드로이드 폰에 설치.
# 사용자 Mac 터미널에서 실행하세요.
#
# 전제:
#   - scripts/build-debug-apk.sh 가 먼저 실행되어 app-debug.apk 가 존재
#   - 폰의 USB 디버깅이 켜져 있고 Mac이 신뢰됨
#
# 흐름:
#   1) adb 존재 확인
#   2) 연결된 디바이스 1대 이상 확인
#   3) 동일 패키지명이 다른 서명으로 이미 설치되어 있으면 안내
#   4) adb install -r 로 설치
#
# 동시에 여러 디바이스가 연결되어 있으면 첫 번째 디바이스에 설치.
# 특정 디바이스 지정 시: ANDROID_SERIAL=<serial> bash install-to-phone.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APK_PATH="$PROJECT_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
PACKAGE_NAME="com.anonymous.musicplayer"

green() { printf "\033[32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
red() { printf "\033[31m%s\033[0m\n" "$1"; }

green "==> ET-Music Debug APK 설치"
echo ""

# ─── 1. APK 존재 확인 ────────────────────────────────────────────────────────
if [[ ! -f "$APK_PATH" ]]; then
  red "✗ APK 파일이 없습니다: $APK_PATH"
  echo "  먼저 빌드부터:"
  echo "    bash $SCRIPT_DIR/build-debug-apk.sh"
  exit 1
fi
echo "✓ APK 존재: $(du -h "$APK_PATH" | cut -f1)"

# ─── 2. adb 확인 ────────────────────────────────────────────────────────────
if ! command -v adb >/dev/null 2>&1; then
  if [[ -x "${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb" ]]; then
    export PATH="$PATH:${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools"
  else
    red "✗ adb 가 PATH에 없습니다."
    echo "  ~/.zshrc 에 추가:"
    echo "    export PATH=\"\$PATH:\$ANDROID_HOME/platform-tools\""
    exit 1
  fi
fi
echo "✓ adb: $(adb --version | head -1)"
echo ""

# ─── 3. 디바이스 연결 확인 ──────────────────────────────────────────────────
green "==> USB 디바이스 확인"
adb start-server >/dev/null 2>&1 || true

DEVICES_RAW="$(adb devices | tail -n +2 | awk 'NF>0')"
DEVICE_COUNT="$(echo "$DEVICES_RAW" | grep -c "device$" || true)"

if [[ "$DEVICE_COUNT" -lt 1 ]]; then
  red "✗ 연결된 디바이스가 없습니다."
  echo ""
  echo "체크리스트:"
  echo "  1) USB 케이블 연결되어 있는가?"
  echo "  2) 폰 설정 → 개발자 옵션 → USB 디버깅 ON ?"
  echo "  3) 폰에 'USB 디버깅 허용' 다이얼로그가 떴다면 '항상 허용' 체크 후 확인"
  echo "  4) 데이터 전송 모드 확인 (충전 전용 모드면 인식 안 됨)"
  echo ""
  echo "현재 adb 상태:"
  adb devices
  exit 1
fi
echo "$DEVICES_RAW" | sed 's/^/  /'

if [[ "$DEVICE_COUNT" -gt 1 ]]; then
  yellow "ⓘ 디바이스가 여러 대 연결되어 있습니다."
  if [[ -z "${ANDROID_SERIAL:-}" ]]; then
    FIRST_SERIAL="$(echo "$DEVICES_RAW" | grep "device$" | head -1 | awk '{print $1}')"
    yellow "  자동으로 첫 번째 디바이스($FIRST_SERIAL)에 설치합니다."
    yellow "  특정 디바이스 지정: ANDROID_SERIAL=<serial> bash install-to-phone.sh"
    export ANDROID_SERIAL="$FIRST_SERIAL"
  else
    echo "  지정된 디바이스: $ANDROID_SERIAL"
  fi
fi
echo ""

# ─── 4. 기존 설치 충돌 검사 ─────────────────────────────────────────────────
EXISTING_PKG="$(adb shell pm list packages "$PACKAGE_NAME" 2>&1 | tr -d '\r' | head -1)"
if [[ "$EXISTING_PKG" == "package:$PACKAGE_NAME" ]]; then
  echo "✓ 기존에 같은 앱이 설치되어 있습니다 → 업데이트 설치 시도"
fi

# ─── 5. 설치 ────────────────────────────────────────────────────────────────
green "==> adb install -r"
echo ""

set +e
INSTALL_OUTPUT="$(adb install -r "$APK_PATH" 2>&1)"
INSTALL_EXIT=$?
set -e

echo "$INSTALL_OUTPUT"

if [[ $INSTALL_EXIT -ne 0 ]] || echo "$INSTALL_OUTPUT" | grep -q "Failure"; then
  echo ""
  red "✗ 설치 실패"

  if echo "$INSTALL_OUTPUT" | grep -q "INSTALL_FAILED_UPDATE_INCOMPATIBLE"; then
    yellow ""
    yellow "ⓘ 기존에 설치된 같은 패키지의 서명이 달라서 업데이트 불가."
    yellow "  해결: 기존 앱을 먼저 제거하고 다시 시도."
    yellow "    adb uninstall $PACKAGE_NAME"
    yellow "  그 후:"
    yellow "    bash $0"
  fi

  if echo "$INSTALL_OUTPUT" | grep -q "INSTALL_FAILED_INSUFFICIENT_STORAGE"; then
    yellow ""
    yellow "ⓘ 폰 저장공간이 부족합니다."
  fi

  exit 1
fi

echo ""
green "🎉 설치 완료!"
echo "폰의 앱 서랍에서 'ET-Music' 을 찾아 실행하세요."
echo ""
echo "보컬 트레이너 동선:"
echo "  하단 탭 [트레이너] → 카드 3개 (마이크 테스트 / 음역대 측정 / 스케일 연습)"
echo "  스케일 연습에서 '녹음하며 듣기' 토글로 본인 발성 리플레이 가능."
