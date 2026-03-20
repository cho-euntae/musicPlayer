# Music Player

로컬 음악 파일을 재생하는 Android 앱 (React Native + Expo)

---

## 기술 스택

- **React Native** + **Expo SDK 54**
- **Expo Router** - 파일 기반 라우팅
- **expo-audio** - 오디오 재생
- **expo-media-library** - 기기 음악 목록 접근
- **Zustand** - 전역 상태 관리

---

## 프로젝트 구조

```
app/
├── _layout.tsx              # 루트 레이아웃
├── player.tsx               # 풀스크린 플레이어 (모달)
├── playlist/[id].tsx        # 플레이리스트 상세
└── (tabs)/
    ├── _layout.tsx          # 탭바 + 미니 플레이어
    ├── index.tsx            # Home 화면
    ├── library.tsx          # Library (기기 음악 목록)
    └── playlists.tsx        # Playlists

store/
└── player-store.ts          # 재생 상태 (큐, 셔플, 반복 등)

hooks/
├── use-media-library.ts     # 기기 음악 목록 로드
└── use-audio-player.ts      # 오디오 재생 제어

components/
├── track-item.tsx           # 트랙 목록 아이템
├── mini-player.tsx          # 탭바 위 미니 플레이어
└── player/
    ├── progress-bar.tsx     # 시크 가능한 진행 바
    └── controls.tsx         # 재생/이전/다음/셔플/반복 버튼
```

---

## 개발 환경 설정 (최초 1회)

### 1. 패키지 설치

```bash
npm install
```

### 2. Android SDK 환경변수 설정 (최초 1회)

**Mac** - `~/.zshrc` 파일에 추가:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
```

저장 후 터미널에서 적용:

```bash
source ~/.zshrc
```

**Windows** - 시스템 환경변수에 추가:

1. 시스템 속성 → 환경변수
2. 새로 만들기: `ANDROID_HOME` = `C:\Users\[사용자명]\AppData\Local\Android\Sdk`
3. PATH에 추가: `%ANDROID_HOME%\platform-tools`

---

### 3. Android SDK 경로 설정

`android/local.properties` 파일을 직접 생성해야 합니다. (Git에 포함되지 않음)

**Mac:**

```
sdk.dir=/Users/cho-euntae/Library/Android/sdk
```

**Windows:**

```
sdk.dir=C\:\\Users\\[윈도우 사용자명]\\AppData\\Local\\Android\\Sdk
```

> Windows 경로는 `\` 를 `\\`로 작성해야 합니다.

### 3. 핸드폰 개발자 모드 활성화

1. 설정 → 휴대전화 정보 → **빌드 번호 7번 연속 탭**
2. "개발자가 되었습니다" 메시지 확인
3. 설정 → **보안 → 보안 위협 자동 차단 OFF**
4. 설정 → **개발자 옵션** → 맨 위 토글 ON
5. **USB 디버깅** ON

### 4. 핸드폰 연결

1. USB 케이블로 Mac에 연결
2. 핸드폰 알림바에서 **"파일 전송"** 선택
3. 핸드폰에 "USB 디버깅 허용?" 팝업 뜨면 **허용**

### 5. 연결 확인

```bash
~/Library/Android/sdk/platform-tools/adb devices
# 아래처럼 기기가 표시되면 성공
# R3CX20DPG7J    device
```

---

## 실행 방법

### 최초 실행 (앱 빌드 + 설치)

```bash
npx expo run:android --device
# 빌드에 5~10분 소요
```

### 이후 실행 (앱이 이미 설치된 경우)

```bash
npx expo start
npx expo start --clear --dev-client
# 핸드폰에서 music-player 앱 실행하면 자동 연결
# USB 없이 Wi-Fi로도 가능
```

### 코드 수정 반영

- 파일 저장하면 핫 리로드로 **핸드폰에 자동 반영**
- 강제 새로고침: 터미널에서 `r` 키 입력

### apk로 뽑아내기

방법 1 - 로컬 빌드 (빠름, 추천)
Mac에서 직접 빌드:

cd /Users/cho-euntae/Desktop/Dev/vscode_workspace/music-player
npx expo run:android --variant release
빌드 완료 후 APK 위치:

android/app/build/outputs/apk/release/app-release.apk
이 APK 파일을 핸드폰으로 전송해서 설치하면 됩니다.
