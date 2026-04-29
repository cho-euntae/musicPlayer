# 개발 진행 현황

## ✅ 완료된 기능

### 기반 구조

- [x] Expo Router 기반 탭 네비게이션 (Home / Library / Playlists)
- [x] Zustand 전역 상태 관리 (재생 상태, 큐, 즐겨찾기, 플레이리스트)
- [x] AsyncStorage 영구 저장 (앱 재시작해도 데이터 유지)
- [x] AudioPlayerContext - 단일 오디오 인스턴스 (앱 전체 공유)

### 음악 불러오기

- [x] 기기 오디오 파일 전체 로드 (expo-media-library)
- [x] 권한 요청 (Android 오디오 권한)
- [x] 통화 녹음 파일 자동 제외 (TPhoneCallRecords 등)

### 재생

- [x] 트랙 재생 / 일시정지
- [x] 이전 곡 / 다음 곡
- [x] 셔플 모드
- [x] 반복 모드 (off / 전체 / 한 곡)
- [x] 시크바 (재생 위치 탐색)
- [x] 트랙 종료 시 자동 다음 곡 재생
- [x] 트랙 전환 시 중복 재생 방지

### UI 컴포넌트

- [x] TrackItem - 트랙 목록 아이템 (즐겨찾기 표시, ⋮ 메뉴)
- [x] MiniPlayer - 탭바 위 고정 미니 플레이어
- [x] 풀스크린 플레이어 (진행 바 + 컨트롤)
- [x] TrackOptionsModal - 트랙 옵션 바텀 시트
- [x] 현재 재생 큐 화면
- [x] 홈 화면 재생 중심 개편

### 플레이리스트

- [x] 즐겨찾기 (자동 생성)
- [x] 최근 재생 (자동 기록, 최대 50곡)
- [x] 커스텀 플레이리스트 생성 / 삭제
- [x] 플레이리스트에 트랙 추가
- [x] 플레이리스트 전체 재생

---

## 🔲 예정된 기능

### 핵심 안정화 (필수)

- [x] 백그라운드 재생 안정화 (화면 꺼짐/앱 백그라운드 유지)
- [x] 오디오 포커스 처리 (전화/알람/다른 앱 재생 시 pause, 끝나면 resume)
- [x] 헤드셋 / 블루투스 버튼 제어 + 락스크린 컨트롤 (setActiveForLockScreen)
- [x] 마지막 재생 상태 복원 (큐/현재곡/위치 5초마다 저장, 앱 재시작 시 복원)

### 검색 / 정렬

- [x] Library 검색 (곡 이름 / 아티스트 / 앨범으로 필터링)
- [x] 정렬 기능 (이름순 / 최신순 / 재생 횟수순)
- [x] 재생 횟수 기록
- [x] 검색 debounce 적용 (성능 최적화)

### 플레이리스트 개선

- [x] 플레이리스트에서 곡 제거 (휴지통 버튼 + 확인 알림)
- [x] 플레이리스트 순서 변경 (드래그)
- [x] 플레이리스트 이름 변경
- [x] 플레이리스트 중복 곡 추가 정책 (동일 id 중복 방지, 건너뜀 알림)
- [x] 다중 선택 후 플레이리스트에 일괄 추가 (롱프레스로 선택 모드 진입)
- [x] 현재 재생 큐를 플레이리스트로 저장

### 플레이어 기능 추가

- [x] 재생 속도 조절 (0.75x ~ 2.0x)
- [x] 슬립 타이머 (N분 후 자동 정지)
- [ ] 구간 반복 (A-B 반복)
- [x] 현재 재생 큐 화면 (순서 변경 / 제거 / 우선 재생)
- [ ] 볼륨 처리 정책 정리 (시스템 볼륨 연동)
- [x] 손상 파일 / 재생 불가 파일 예외 처리

### UI / 디자인

- [x] 홈 화면 개선 (최근 재생, 즐겨찾기 빠른 접근)
- [ ] 애니메이션 개선
- [x] 빈 상태 화면 (곡 없음 / 플레이리스트 없음 / 검색 결과 없음)
- [x] 권한 거부 안내 UI (미디어 권한 요청 가이드)

### 라이브러리 고도화

- [ ] 아티스트 / 앨범 / 폴더 분류
- [x] 중복 파일 필터링
- [ ] 스캔 제외 폴더 설정
- [x] 메타데이터 fallback 처리 (제목/아티스트 없음 대응)

### 설정

- [x] 통화녹음 숨기기 on/off
- [x] 최근 재생 저장 개수 설정
- [x] 기본 정렬 방식 설정
- [x] 테마 설정 (시스템/다크/라이트) — 시스템 자동 추종, 설정 화면 + 상태바 시각 적용 (다른 화면은 점진적 확장 예정)

### 빌드 / 배포

- [x] 릴리즈 APK 빌드 완료
- [ ] 앱 아이콘 / 스플래시 화면 커스텀

---

## 작업 로그

### 2026-04-29 (사용자 편의성 5종 스프린트)

- 미니플레이어 제스처 추가: `react-native-gesture-handler`의 `PanGestureHandler`로 좌(다음 곡) / 우(이전 곡, 스마트) / 위(풀스크린 열기) / 아래(큐 비우고 닫기) 스와이프 지원. `activeOffsetX/Y=12`로 일반 탭(재생/다음 버튼)과 분리, 거리 50dp 또는 속도 600dp/s 임계값 만족 시 인식. `expo-haptics`로 가벼운 햅틱 피드백
- 똑똑한 "이전 곡" 버튼: `audio-player-context`에 `playPrev` 신규. `TrackPlayer.getProgress()`의 실시간 position을 읽어 5초 이내면 스토어 `playPrev()`로 진짜 이전 트랙 이동, 5초 이후면 `seekTo(0)`으로 현재 곡 처음부터. 스토어 `playPrev`는 단순화(항상 이전 트랙으로). 기존 3초 임계값 → 5초로 확장
- ±10초 / ±30초 스킵 버튼: `audio-player-context`에 `skipBy(deltaMs)` 신규, 현재 위치 + delta를 트랙 길이로 클램프하여 시킹. 풀스크린 플레이어 진행 바 아래에 4개 버튼 칩 row 추가 (-30 / -10 / +10 / +30)
- 앨범 아트 표시: `components/track-artwork.tsx` 신규 — `<Image>` 로드 시도 → `onError` fallback으로 트랙 ID 해시 기반 12색 팔레트 + 첫 글자(한글/영문/숫자/이모지 모두 한 글자) 카드. `use-media-library`에서 Android `albumId` 존재 시 `content://media/external/audio/albumart/<id>` URI를 `track.artwork`에 자동 매핑(미디어스토어 표준). 트랙 리스트, 미니플레이어, 풀스크린 플레이어 3곳에 적용. iOS/aritwork 부재 시 모두 fallback이 자동 표시
- 시스템 테마 자동 추종: `hooks/use-theme.ts` 신규 — `RN useColorScheme()`과 스토어 `themeMode`를 결합해 effective scheme + ThemeColors 토큰 반환. `themeMode='system'`이면 디바이스 다크/라이트 따라 자동 전환. `app/_layout.tsx`의 StatusBar를 `<ThemedStatusBar />`로 분리해 색상도 자동 전환. `app/settings.tsx`를 `createStyles(colors)` 패턴으로 리팩토링해 라이트/다크 양쪽 시각 적용. 기타 화면(Home/Library/Playlists/Player/MiniPlayer 등)은 점진적 적용 예정
- 검증: `npx tsc --noEmit` (`app-example/` 템플릿 제외 오류 없음), `npm run lint` 통과

### 2026-04-29 (B-2 스프린트)

- 1번 알림 일시정지 동작 복구: `TrackPlayer.registerPlaybackService` 호출이 React 컴포넌트 트리(`_layout.tsx`) 내부에서만 실행돼 헤드리스 알림 액션 시 `RemotePause`/`RemotePlay` 핸들러가 비어 있던 문제 수정. 진입점 `index.js` 신설, `expo-router/entry` 이전에 service를 등록하도록 순서 보장. `package.json` `main` → `index.js`
- 2번 빈 상태 화면 통일: 라이브러리에 곡 0개 / 스캔 실패 카드 추가(`다시 스캔` / `다시 시도` 버튼, 스캔 중엔 인디케이터). 큐 화면 빈 상태를 다른 화면(즐겨찾기/최근/플레이리스트/홈)과 동일한 카드+아이콘+액션 버튼 패턴으로 일관화
- 3번 설정 화면 추가: `app/settings.tsx` 신설, 홈 헤더에 톱니 아이콘 진입점. 스토어에 `hideCallRecordings` / `recentlyPlayedLimit` (`20|50|100|200`) / `themeMode` 필드와 액션 추가, partialize에 포함해 영속화. `useMediaLibrary` 통화녹음 필터를 토글 연동, 토글 즉시 `refresh()` 재스캔. `addToRecentlyPlayed` 슬라이스 길이를 `recentlyPlayedLimit`과 연동, 설정 변경 시 즉시 잘라냄. 기본 정렬은 기존 `librarySortMode` 노출. 테마는 값만 보관(다크 외 선택 시 안내 알림)

### 2026-04-20 (B-1 스프린트)

- 슬립 타이머 추가: 스토어에 `sleepTimerEndAt`(앱 재시작 시 초기화) 필드와 `setSleepTimerMinutes` 액션, `AudioPlayerProvider`에서 만료 시각 도달 시 `TrackPlayer.pause()` + 자동 클리어. 풀스크린 플레이어에 달 아이콘 칩 추가, 활성 시 `m:ss` 남은 시간 실시간 표시
- 재생 속도 조절 추가: 스토어에 `playbackRate`(영속화) 필드와 `setPlaybackRate` 액션, `TrackPlayer.setRate()` 동기화. 풀스크린 플레이어에 속도계 아이콘 칩 + 6단계 선택 모달 (0.75× / 1× / 1.25× / 1.5× / 1.75× / 2×)
- 플레이리스트 이름 변경 UI 추가: 커스텀 플레이리스트 상세 화면 상단에 연필 아이콘, 공용 `TextInputModal`에서 이름을 받아 기존 스토어 액션 `renamePlaylist` 연결
- 현재 재생 큐 → 플레이리스트 저장 플로우 추가: 스토어에 `savePlaylistFromTracks` 액션 신규, 큐 화면 헤더에 북마크 아이콘 → `TextInputModal`로 새 플레이리스트 이름 입력 → 저장 후 완료 알림
- 공용 컴포넌트 2종 신규: `components/text-input-modal.tsx`(플레이리스트 이름 변경·큐 저장 공용), `components/options-sheet-modal.tsx`(슬립 타이머·재생 속도 공용). 향후 옵션/입력 다이얼로그가 필요할 때 재사용
- 검증: `npx tsc --noEmit` 오류 없음, `npm run lint` 통과

### 2026-04-20

- 릴리즈 APK 먹통 증상 원인 진단: 설치본이 디버그 빌드여서 Metro(`localhost:8081`) 번들을 기다리다 스플래시에서 정지. `adb logcat`의 `BridgelessDevSupportManager` / `Failed to connect to localhost/127.0.0.1:8081` 메시지로 확정
- 라이브러리 정렬 기능 추가: 스토어에 `librarySortMode` (`name`/`recent`/`playCount`) 필드와 `setLibrarySortMode` 액션, partialize에 포함해 영속화. 라이브러리 화면 헤더 하단에 정렬 칩 3개 UI 추가
- 검색 debounce 도입: `hooks/use-debounce.ts` 추가, 라이브러리 검색 입력을 250ms debounce 처리해 타이핑 중 필터링 비용 절감
- 재생 오류 처리 추가: `Event.PlaybackError` 수신 시 `playback-service`에서 자동으로 다음 곡 스킵, 실패 시 `TrackPlayer.reset()`으로 복구. `AudioPlayerProvider`에서도 같은 이벤트로 `isPlaying=false` 동기화
- 저장소에서 사라진 파일이 `lastQueue`에 남아 복원 시 무한 대기 또는 정지처럼 보이던 문제 해소 (위 PlaybackError 핸들러 경유)
- `_layout.tsx` `AppInitializer`가 `usePlayerStore()`를 통째로 구독하던 것을 필드별 셀렉터로 분리해 매 1초 progress 갱신마다 발생하던 전역 리렌더 제거
- `AudioPlayerProvider`의 스토어 구독도 셀렉터 단위로 전부 분리
- `hooks/use-media-library.ts`를 모듈 스코프 `scanState`로 재구성해 앱 생애주기 동안 전체 오디오 스캔이 최초 1회만 실행되도록 수정. 여러 컴포넌트가 동시에 `useMediaLibrary`를 호출해도 중복 스캔 없음. `tracks`는 이제 스토어의 `libraryTracks`를 직접 반환
- 알림(상단 작업표시줄) 일시정지가 눌려도 즉시 재생 재개되던 증상 수정: `syncPlaybackState` 이펙트의 stale closure + 취소 미적용으로 인한 경합을 제거하기 위해 해당 이펙트를 삭제, `togglePlay`는 네이티브 `getPlaybackState` 기준으로 직접 `TrackPlayer.play()`/`pause()`를 호출하도록 변경. 스토어 `isPlaying`은 네이티브 → 스토어 단방향 동기화만 유지
- 검증: `npx tsc --noEmit` (`app-example/` 템플릿 제외 오류 없음), `npm run lint` 통과

### 2026-03-30

- 앱 시작 시 저장된 재생 큐 복원이 반복 실행되지 않도록 제한하고, 트랙 변경 시 이전 `expo-audio` 플레이어를 즉시 정지하도록 수정해 중복 재생 문제를 완화
- `SM-S928N` 실기기에서 앱 실행 및 확인
- 개발 서버 없이 실행 가능한 릴리즈 APK를 다시 빌드하고 기기에 설치
- 풀스크린 플레이어에서 진입 가능한 현재 재생 큐 화면 추가
- 재생 큐에서 곡 선택, 위/아래 순서 이동, 개별 삭제, 전체 비우기 기능 추가
- 트랙 옵션 메뉴에 `다음에 재생` 기능 추가
- 홈 화면을 현재 재생 상태, 큐, 최근 재생, 즐겨찾기 중심 구조로 개편
- README에 빠른 실행 순서와 Expo 터미널 단축키 정리
- 커밋: `1e6702e 트랙 전환 시 중복 재생 문제 수정`
- 커밋: `7e8319f 재생 큐 화면과 큐 편집 기능 추가`
- 검증: `npm run lint`

### 2026-04-07

- React Native New Architecture를 활성화하고 Android 네이티브 설정도 함께 맞춰 Legacy Architecture 경고를 제거
- Android `assembleDebug` 빌드와 `npm run lint`로 New Architecture 전환 후 기본 검증 완료
- 풀스크린 플레이어 상단 반복 버튼을 `반복 끔 -> 전체 반복 -> 1곡 반복` 순환 방식으로 정리
- 라이브러리 재스캔 시 `asset.id`가 바뀌어도 즐겨찾기 / 최근 재생 / 플레이리스트 / 현재 큐 / 마지막 큐를 최대한 유지하도록 복구 로직 추가
- 복구 기준을 `id -> uri -> 폴더+생성시각+길이 -> 생성시각+길이 -> 제목/아티스트/길이` 순서로 적용
- 이전 라이브러리 스냅샷을 영구 저장해 앱 재시작 후에도 파일명 변경 복구가 가능하도록 보강
- Library에서 곡 선택 시 이전 곡의 재생 위치가 섞이지 않도록 새 큐 선택은 항상 0초부터 시작하게 수정
- Library에서 곡 선택 직후 바로 재생이 시작되도록 TrackPlayer 큐 동기화 직후 `play()` 호출 보강
- 트랙이 실제 활성화될 때만 누적되는 `trackPlayCounts`를 추가해 재생 횟수 기록 지원
- 커스텀 플레이리스트 상세 화면에 드래그 핸들을 추가하고 순서 변경 결과를 영구 저장하도록 수정
- 검증: `npm run lint`

### 2026-03-19

- `favorites` / `recentlyPlayed` 조회 기준을 현재 `queue`에서 전체 라이브러리로 변경
- `use-media-library`에서 불러온 트랙 목록을 전역 스토어의 `libraryTracks`에 동기화
- 플레이리스트 상세 화면에서 `libraryTracks`를 우선 사용해 즐겨찾기와 최근 재생 목록을 구성하도록 수정
- 마지막 재생 상태 복원을 위해 `restoreQueue`와 `pendingSeekPosition` 추가
- 앱 시작 시 저장된 `lastQueue`, `lastTrackIndex`, `lastPosition`을 사용해 복원하도록 루트 초기화 로직 수정
- 오디오가 실제 로드된 뒤 저장된 위치로 `seek`한 다음 재생을 이어가도록 오디오 컨텍스트 수정
- 곡 변경 시 이전 곡의 `lastPosition`이 잘못 남지 않도록 `setQueue`, `setCurrentIndex`, `playNext`, `playPrev`에서 위치 초기화 정리
- 검증: `npm run lint`
