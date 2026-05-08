# 보컬 트레이너 (Vocal Trainer) 기능 설계 & 구현 노트

작성일: 2026-05-07
대상: music-player (ET-Music) — Expo SDK 54 / React Native 0.81 / new architecture

---

## 1. 왜 만드는가

### 사용자 시나리오 (요청자 본인)

1. **마이크 테스트** — 음정 측정 전제 조건. 입력이 정상적으로 들어오는지 확인.
2. **음역대 측정** — 본인이 어디까지 올릴 수 있는지 객관적으로 파악.
3. **스케일 연습** — `도-레-미-파-솔-파-미-레-도` 같은 워밍업 패턴을
   본인 음역에 맞는 키로 들으며 따라 부르기.

### 분리의 이유

- 음악 재생과 보컬 트레이너는 동시 동작이 불가능에 가깝다.
  - iOS `AVAudioSession` 카테고리: `playback` ↔ `playAndRecord` 충돌
  - 헤드셋/BT 라우팅 충돌
  - 화면 의도 자체가 다름 (감상 vs. 연습)
- 따라서 **별도 탭**으로 격리하고, 진입 시 자동으로 재생을 일시정지한다.
- 종료 시 자동 재개는 하지 않는다 — 헤드셋 사용자에게 갑작스러운 음악
  복귀가 거슬릴 수 있고, 미니플레이어로 명시적 재개가 가능.

---

## 2. 화면 구조

```
(tabs)
├── index.tsx          (Home)
├── library.tsx        (Library)
├── playlists.tsx      (Playlists)
└── trainer.tsx        (Trainer 인덱스 — 3개 카드)

trainer/
├── mic-test.tsx       (마이크 테스트)
├── range-test.tsx     (음역대 측정)
└── scale-practice.tsx (스케일 연습)
```

탭은 `app/(tabs)/_layout.tsx`에 한 줄 추가, Stack 등록은 `app/_layout.tsx`.

---

## 3. 핵심 모듈

### `lib/trainer/notes.ts`
- MIDI ↔ 주파수 변환 (`midiToFrequency`, `frequencyToMidi`)
- 음 이름 표시 (`midiToNote` → `{ midi, name: 'C4', nameKo: '도4', frequency, octave }`)
- 스케일 생성 (`cMajorScale`, `vocalizeScaleUpDown`)
- cent 단위 음정 차이 (`centsBetween`) — 추후 실시간 매칭에 사용

### `lib/trainer/sine-wav.ts`
- 주파수와 길이를 받아 16-bit PCM mono WAV을 메모리에서 합성
- expo-file-system cache 디렉토리에 file URI로 저장
- 주파수+길이 조합을 메모이즈해 같은 음 반복 재생 시 디스크 I/O 0
- ADSR fade in/out (20ms)로 시작/끝 클릭 노이즈 제거
- **Why**: RN에는 Web Audio가 없어 OscillatorNode 같은 합성기가 없다.
  미리 wav를 번들에 50개 넣는 방식보다 합성이 가볍고 옥타브 확장이 쉽다.

### `hooks/use-trainer-session.ts`
- `useFocusEffect`로 화면 진입 시 `TrackPlayer.pause()` 호출
- 이미 멈춰있으면 no-op
- 종료 시 자동 재개하지 않음

### Store 확장 (`store/player-store.ts`)
- `vocalRangeLowMidi: number | null`
- `vocalRangeHighMidi: number | null`
- `vocalRangeMeasuredAt: number | null`
- 액션: `setVocalRange(low, high)`, `clearVocalRange()`
- `partialize`에 포함되어 영속화

---

## 4. 화면별 동작

### 4-1. 마이크 테스트 (`trainer/mic-test.tsx`)

- `expo-audio`의 `useAudioRecorder` + `useAudioRecorderState(50ms 폴링)`
- `metering` (dBFS) 값을 -60 ~ -10 dB 범위로 정규화해 가로 막대로 표시
- 시각적 피드백:
  - 회색: 입력 없음 / 너무 작음
  - 녹색: 정상 감지
  - 빨강: 클리핑 (너무 큼)
- 권한: `requestRecordingPermissionsAsync()` 진입 시 요청
- 세션: `setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })`
  - 화면 이탈 시 `allowsRecording: false`로 원복

### 4-2. 음역대 측정 (`trainer/range-test.tsx`)

**현재(MVP)**: pitch 인식 없는 단계적 자가확인 방식

흐름:
1. C4(60)에서 시작
2. 사용자 응답:
   - "낼 수 있음" → 한 반음 위로
   - "못 냄" → 직전 음을 high로 확정, 하한 탐색 시작
3. 하한 탐색: C4에서 한 반음씩 아래로
4. 양 끝 확정 → store에 저장

기준음은 `ensureSineWavFile`로 합성된 사인파 1.5초.
재생은 `createAudioPlayer(uri)`로 1회성 인스턴스 생성/제거.

**향후 확장**: pitch 인식 모듈을 끼워 넣으면 자가확인 → 객관 측정으로
교체 가능 (응답 분기에 `if (detectedHz close to targetHz) auto-pass` 추가).

### 4-3. 스케일 연습 (`trainer/scale-practice.tsx`)

- 측정된 음역대 중앙을 기본 시작 키로 추천 (없으면 C4)
- ± 버튼으로 반음씩 키 조정
- "재생" 누르면 `vocalizeScaleUpDown(rootMidi)` (도-레-미-파-솔-파-미-레-도, 9음)을
  700ms씩 100ms 간격으로 순차 재생
- 현재 재생 중인 음을 카드로 강조 표시
- 음역대 밖이면 경고 텍스트 표시

---

## 5. 설치된 의존성

`package.json`에 추가:
- `expo-audio ~1.1.1` — 녹음 + 짧은 wav 재생

`app.json` 변경:
- `ios.infoPlist.NSMicrophoneUsageDescription` 추가
- `expo-audio` plugin (마이크 권한 텍스트)

기존 자산으로 충분한 부분:
- `expo-file-system` (이미 transitive 설치) — wav 파일 캐시
- `expo-haptics` — 추후 햅틱 추가 시 사용 가능

---

## 6. 격리 정책 정리

| 트리거 | 동작 | 구현 위치 |
|---|---|---|
| Trainer 인덱스 진입 | `TrackPlayer.pause()` | `(tabs)/trainer.tsx` → `useTrainerSession()` |
| 하위 화면 진입 (mic/range/scale) | `TrackPlayer.pause()` 재차 (방어적, no-op이면 그대로 통과) + 필요 시 mic 권한 요청 + audio mode 전환 | 각 화면 → `useTrainerSession()`, mic 화면은 추가로 `useTrainerMicSession(recorder)` |
| Trainer 화면 이탈 | 자동 재개 X. mic 사용 화면은 `recorder.stop()` 후 `allowsRecording: false`로 mode 원복 | `useTrainerMicSession` cleanup |
| Trainer 안에서 재생되는 reference tone | `expo-audio`의 별도 `AudioPlayer` 인스턴스 — TrackPlayer 큐와 분리 | `lib/trainer/sine-wav.ts` + 각 화면 |

> **중복 호출에 대한 메모**: 하위 화면에서도 `useTrainerSession()`을 다시 호출하는 것은
> 의도된 방어 패턴이다. 인덱스를 거치지 않고 (예: 딥링크) 진입했을 때도 일시정지가 보장되어야
> 하므로 redundant but safe 정책으로 유지한다.

> **mic 권한/오디오 모드 책임 분리**: mic 권한 요청과 `setAudioModeAsync` 전환은
> `hooks/use-trainer-mic-session.ts`에 모여 있다. 추가로 마이크가 필요한 화면이 생겨도
> 이 훅 하나만 호출하면 되며, 화면 컴포넌트에서 권한/모드 코드를 다시 작성하지 않는다.

---

## 7. 향후 패치(다음 스프린트)

### P1 — 실시간 pitch 인식
- 후보 1: `react-native-pitchy` (네이티브 YIN)
- 후보 2: `react-native-live-audio-stream` (PCM 스트림) + `pitchfinder` (JS YIN)
- 1번이 단순. 2번이 알고리즘 교체 자유도 높음
- 채택 시 `range-test`의 자가확인이 자동 측정으로 교체되고
  `scale-practice`에 "맞음 / 낮음 / 높음" 시각화가 붙는다

### P2 — 진행 기록
- 측정 이력 (날짜별 음역대 변화) 저장 → 상승 추세 시각화

### P3 — 더 다양한 워밍업 패턴
- 현재: `도-레-미-파-솔-파-미-레-도` 한 종류
- 추가 후보: `도-미-솔-도` (3화음 분산), 5도 도약, 반음 글리산도 등

### P4 — 음색
- 현재 사인파 → 사용자 호불호 갈릴 수 있음
- 옵션: 톱니파/삼각파, 짧은 페이즈 모듈레이션 등 음색 다양화
- 또는 작은 피아노 샘플 1개를 번들에 넣고 pitch shifting

---

## 8. 빌드 / 동작 체크리스트

- [x] `npx expo install expo-audio` 완료
- [x] `app.json`에 plugin 등록 + iOS NSMicrophoneUsageDescription 추가
- [x] TypeScript 컴파일 클린 (`tsc --noEmit`)
- [x] ESLint 클린 (`expo lint`)
- [ ] **Android 클린 리빌드 필요** — expo-audio 네이티브 모듈 추가됨
  - `npx expo prebuild --clean` 후 `npm run android`
  - 또는 `cd android && ./gradlew clean && cd .. && npm run android`
- [ ] 실기기 동작 검증
  - 인덱스 카드 3개 보임
  - 마이크 권한 다이얼로그 → 허용 → 레벨바 반응
  - 음역대 측정에서 사인파 재생 + 응답에 따라 진행
  - 스케일 연습에서 9음 순차 재생 + 현재 음 강조
  - 음악 재생 중 트레이너 진입 시 자동 일시정지 확인
  - 헤드셋/BT 환경에서도 동일 동작

---

## 9. 알려진 한계

1. **실시간 pitch 미지원** — 현재 음역대 측정은 사용자 자가확인 기반. 객관 측정은 P1에서 추가.
2. **사인파 음색** — 학습용으론 정확하지만 음악적이지는 않음.
3. **세션 충돌 시 복구** — 외부 앱이 audio focus를 가져가면 reference tone이 끊길 수 있음. 현재는 catch-and-warn만 함.
4. **Android allowBackup=false 영향** — 측정된 음역대도 reinstall 시 사라짐 (기존 정책 유지).
