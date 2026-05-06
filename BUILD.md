# APK 로컬 빌드 & 폰 설치 가이드

`android/` 폴더가 이미 prebuild 되어 있어서 `expo prebuild` 단계는 스킵해도 됩니다. 아래 명령은 모두 **사용자 Mac 터미널**에서 실행하세요.

---

## 0. 사전 준비 (한 번만)

### 0-1. JDK 17 (또는 21)
```bash
brew install --cask zulu@17
# 또는
brew install openjdk@17
```

### 0-2. Android SDK + Platform Tools
가장 쉬운 방법: **Android Studio** 설치 → 첫 실행 시 SDK Manager에서 자동으로 SDK 설치됨.
- Android Studio 다운로드: https://developer.android.com/studio

### 0-3. 환경변수 (`~/.zshrc` 에 추가)
```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```
적용:
```bash
source ~/.zshrc
```

### 0-4. 핸드폰 준비
1. 설정 → "휴대전화 정보" → 빌드 번호 7번 탭 → 개발자 옵션 활성화
2. 개발자 옵션 → **USB 디버깅 ON**
3. USB 케이블로 Mac 연결 → 폰에 뜨는 "이 컴퓨터를 신뢰" 다이얼로그 승인

확인:
```bash
adb devices
# 결과에 사용자 폰 시리얼이 보이면 OK
```

---

## 1. 빠른 경로 — Debug APK (개인용 권장)

서명 키 없이 바로 만들고 설치까지 한 줄로 끝낼 수 있습니다.

```bash
cd /Users/cho-euntae/Desktop/Dev/vscode_workspace/music-player

# 1) 의존성 설치 (이미 했다면 스킵)
npm install

# 2) JS 번들이 포함된 APK 빌드
cd android
./gradlew assembleDebug

# 3) APK 위치 확인
ls -lh app/build/outputs/apk/debug/app-debug.apk

# 4) 폰에 설치
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

설치 후 폰의 앱 서랍에 **ET-Music** 으로 보입니다.

---

## 2. Release APK (배포용 / 서명 키 필요)

다른 폰에 배포하거나 Play Store에 올릴 거면 release 빌드를 만들어 서명해야 합니다.

### 2-1. 서명 키 생성 (한 번만)
```bash
cd /Users/cho-euntae/Desktop/Dev/vscode_workspace/music-player/android/app

keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore et-music-release.keystore \
  -alias et-music \
  -keyalg RSA -keysize 2048 -validity 36500
# → 비밀번호 2번 입력 + 이름/조직 등 입력
# → et-music-release.keystore 파일 생성됨 (절대 git에 올리지 말 것!)
```

### 2-2. `android/gradle.properties` 끝에 추가
```properties
ETMUSIC_UPLOAD_STORE_FILE=et-music-release.keystore
ETMUSIC_UPLOAD_KEY_ALIAS=et-music
ETMUSIC_UPLOAD_STORE_PASSWORD=여기에_keystore_비밀번호
ETMUSIC_UPLOAD_KEY_PASSWORD=여기에_alias_비밀번호
```

### 2-3. `android/app/build.gradle` 의 `signingConfigs` 블록에 추가
```gradle
signingConfigs {
    release {
        if (project.hasProperty('ETMUSIC_UPLOAD_STORE_FILE')) {
            storeFile file(ETMUSIC_UPLOAD_STORE_FILE)
            storePassword ETMUSIC_UPLOAD_STORE_PASSWORD
            keyAlias ETMUSIC_UPLOAD_KEY_ALIAS
            keyPassword ETMUSIC_UPLOAD_KEY_PASSWORD
        }
    }
    debug { ... }  // 기존 debug는 그대로 둠
}

buildTypes {
    release {
        signingConfig signingConfigs.release   // ← debug에서 release로 변경
        // ...나머지 기존 설정 유지
    }
}
```

### 2-4. 빌드 + 설치
```bash
cd /Users/cho-euntae/Desktop/Dev/vscode_workspace/music-player/android
./gradlew clean
./gradlew assembleRelease

# 결과물
ls -lh app/build/outputs/apk/release/app-release.apk

# 폰에 설치
adb install -r app/build/outputs/apk/release/app-release.apk
```

---

## 3. 케이블 없이 폰에 설치

`adb install` 외에 두 가지 방법:

- **클라우드 전송**: AirDrop / 카카오톡 "나에게 보내기" / Google Drive 로 APK 업로드 → 폰에서 다운로드 → 탭 → "출처를 알 수 없는 앱 설치" 허용
- **로컬 네트워크**: `python3 -m http.server 8000` 으로 임시 서버 띄우고 폰 브라우저에서 `http://<Mac-IP>:8000/app-debug.apk` 접속해 다운로드

---

## 4. 자주 나는 에러

| 증상 | 해결 |
|---|---|
| `SDK location not found` | `android/local.properties` 파일에 `sdk.dir=/Users/<USER>/Library/Android/sdk` 한 줄 추가 |
| `Unsupported class file major version 65` | JDK 21 사용 중 → JDK 17로 다운그레이드 |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | 기존에 설치된 같은 패키지(다른 서명) 제거: `adb uninstall com.anonymous.musicplayer` (정확한 패키지명은 `app.json` 또는 `AndroidManifest.xml` 확인) |
| `Could not connect to development server` (debug build에서) | 핸드폰 흔들기 → Dev Settings → Debug server host = `<Mac-IP>:8081`. 또는 release 빌드 사용 |
| 빌드는 되는데 음악이 안 들림 | 권한 미허용. 앱 설치 후 첫 실행 시 미디어 라이브러리 권한 허용 필요 |

---

## 5. 빌드 시간 단축 팁

- 첫 빌드는 5–15분 소요. 이후는 캐시로 1–3분.
- `./gradlew assembleDebug --offline` 으로 의존성 다운로드 스킵 가능 (한 번 받은 후)
- 개발 중에는 `npx expo run:android` 로 빌드 + 설치 + Metro 자동 실행 한 번에 가능

---

## 6. 패키지명 확인

`app.json` 의 `android` 블록에 `package` 필드가 없으면 Expo가 자동 생성한 이름(`com.anonymous.musicplayer` 등)이 쓰입니다. 명시하려면:

```json
"android": {
  "package": "com.et.musicplayer",
  ...
}
```
변경 후에는 `npx expo prebuild --clean` 으로 android/ 재생성 필요.
