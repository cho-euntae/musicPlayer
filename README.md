# Music Player

로컬 음악 파일을 재생하는 Android 앱 (React Native + Expo).

## 주요 기능

- 기기 오디오 라이브러리 스캔(통화 녹음 필터, 재스캔 시 ID/URI/파일명 변경 복원)
- 풀스크린 플레이어 + 미니 플레이어 + 락스크린/알림 미디어 컨트롤
- 셔플, 반복(off / 전체 / 한 곡), 시크바, 슬립 타이머, 0.75x~2.0x 재생 속도
- 큐 편집(순서 변경, 우선 재생, 큐를 플레이리스트로 저장)
- 즐겨찾기 / 최근 재생 / 커스텀 플레이리스트(드래그 정렬, 이름 변경, 다중 선택 추가)
- 검색(debounce), 정렬 칩(이름/최신/재생순)
- 설정 화면(통화녹음 숨김 토글, 최근 재생 한도, 기본 정렬, 테마)
- 마지막 재생 큐/위치 5초마다 저장 → 앱 재시작 시 복원

자세한 진행 현황은 [PROGRESS.md](./PROGRESS.md) 참고.

---

## 기술 스택

- **React Native** + **Expo SDK 54**
- **Expo Router** - 파일 기반 라우팅
- **react-native-track-player** - 백그라운드 오디오 재생 및 미디어 컨트롤
- **expo-media-library** - 기기 음악 목록 접근
- **Zustand** - 전역 상태 관리

---

## 프로젝트 구조

```
index.js                     # 엔트리 — TrackPlayer playback service 등록 후 expo-router 부팅
                             # (헤드리스 알림 액션 시에도 RemotePause/Play 핸들러가 살아 있도록)

app/
├── _layout.tsx              # 루트 레이아웃 (Stack)
├── player.tsx               # 풀스크린 플레이어 (모달, 슬립 타이머/속도 조절 칩 포함)
├── queue.tsx                # 현재 재생 큐 화면 (순서 변경 / 제거 / 큐를 플레이리스트로 저장)
├── settings.tsx             # 설정 (통화녹음 숨김 / 최근 재생 한도 / 기본 정렬 / 테마)
├── playlist/[id].tsx        # 플레이리스트 상세 (즐겨찾기·최근 재생·커스텀)
└── (tabs)/
    ├── _layout.tsx          # 탭바 + 미니 플레이어
    ├── index.tsx            # Home (재생 중심, 큐/설정 진입점)
    ├── library.tsx          # Library (검색 + 정렬 칩 + 빈 상태 카드)
    └── playlists.tsx        # Playlists (자동 + 커스텀)

store/
└── player-store.ts          # Zustand persist (큐, 셔플, 반복, 즐겨찾기, 설정 등)

context/
└── audio-player-context.tsx # TrackPlayer 셋업 + 큐 동기화 + togglePlay/seekTo

services/
├── playback-service.ts      # RemotePlay/Pause/Next/Previous/Seek + PlaybackError 핸들러
└── register-track-player.ts # registerPlaybackService 가드 + 등록

hooks/
├── use-media-library.ts     # 기기 오디오 스캔 (앱 단위 1회), 통화녹음 필터, refresh
└── use-debounce.ts          # 검색 입력 debounce

components/
├── track-item.tsx           # 트랙 목록 아이템 (즐겨찾기 표시, ⋮ 메뉴, 다중 선택 지원)
├── mini-player.tsx          # 탭바 위 미니 플레이어
├── track-options-modal.tsx  # 트랙 옵션 바텀 시트 (다음에 재생 등)
├── playlist-picker-modal.tsx # 다중 선택 → 플레이리스트 추가
├── text-input-modal.tsx     # 이름 입력 공용 (플레이리스트 이름 변경 / 큐 저장)
├── options-sheet-modal.tsx  # 옵션 선택 공용 (슬립 타이머 / 재생 속도 / 설정 모달)
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

### 빠른 실행 요약

프로젝트 다시 켰을 때 가장 자주 쓰는 순서:

```bash
cd /Users/cho-euntae/Desktop/Dev/vscode_workspace/music-player
npm install
npm run android
```

- `npm run android`
  - 안드로이드 앱 빌드 + 설치 + 실행
- 이미 앱이 설치되어 있고 개발 서버만 다시 띄우면 될 때:

```bash
npm start
```

- 릴리즈 APK를 다시 만들 때:

```bash
cd android
./gradlew assembleRelease
```

APK 위치:

```bash
android/app/build/outputs/apk/release/app-release.apk
```

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

### 터미널 단축키

Expo 개발 서버가 켜져 있을 때 터미널에서 자주 쓰는 키:

- `r`
  - 앱 강제 새로고침
- `a`
  - Android 실행/연결
- `m`
  - 개발자 메뉴 열기
- `Ctrl + C`
  - 개발 서버 종료

### apk로 뽑아내기

방법 1 - 로컬 빌드 (빠름, 추천)
Mac에서 직접 빌드:

cd /Users/cho-euntae/Desktop/Dev/vscode_workspace/music-player
npx expo run:android --variant release
빌드 완료 후 APK 위치:

android/app/build/outputs/apk/release/app-release.apk
이 APK 파일을 핸드폰으로 전송해서 설치하면 됩니다.
