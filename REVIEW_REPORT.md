# 보컬 트레이너 코드 리뷰 보고서

- 작성일: 2026-05-08
- 대상: `feat(trainer)` 커밋군 (`fd333f4` ~ `89149ba`) + 후속 수정
- 리뷰어: TypeScript / 코드 아키텍트 / 성능 최적화 (1차) → 보안 리뷰 (2차, 수정본 기준)
- 검증: `tsc --noEmit` 트레이너 영역 0 에러, `eslint` exit 0, `jest` 27 tests passed

---

## 1차 리뷰 (TypeScript / 아키텍트 / 성능) — 적용 완료

### P0 (적용)
- `lib/trainer/sine-wav.ts` — 캐시 키 MIDI 정수 기반 + LRU 50, `ensureSineWavFileForMidi` 신설, 주파수 진입점은 nearestMidi로 양자화
- `app/trainer/scale-practice.tsx` — 단일 AudioPlayer + `replace(uri)` (없으면 `await remove()` fallback)로 race 제거, 정규식 → `noteNameKoBase()` 헬퍼, 사용자 수동 키 보존
- `app/trainer/mic-test.tsx` — metering 폴링 50→100ms (상수 `METERING_POLL_MS`)

### P1 (적용)
- `app/trainer/range-test.tsx` — `enterMeasuringLow(high)` 헬퍼로 phase 전이 단일화, `highCandidate` null fallback 제거 + 안전망
- `hooks/use-trainer-session.ts` — `useUnmount` cleanup을 ref로 잡아 deps `[]` 고정
- `hooks/use-trainer-mic-session.ts` 신규 — 권한+`setAudioModeAsync` 책임 분리, `recorderRef`로 cleanup 안전성 확보
- `app/trainer/mic-test.tsx` — eslint-disable 제거, 새 훅 호출로 단순화
- `VOCAL_TRAINER.md §6` — 격리 정책 표 갱신, 하위 화면 중복 호출이 의도된 방어 패턴임을 명시

### P2 (적용)
- `lib/trainer/notes.ts` — `noteNameKoBase()` 헬퍼 추가, `cMajorScale` 사용 의도 주석
- `app/(tabs)/trainer.tsx` — `as never` 3곳 제거 (typedRoutes 정상 동작 확인)

---

## 2차 보안 리뷰 (수정본 기준) — 후속 조치 필요

### 🔴 즉시 조치 필요

1. **`app.json` mic 권한 텍스트 명확화**
   - 현재: "보컬 트레이너에서 마이크 입력을 분석합니다."
   - 사용자가 실제 데이터 처리 방식을 알 수 없음 → 권한 수락/거부 판단 정보 부족
   - **수정안**: 예) "음정 측정을 위해 마이크 입력을 실시간으로 분석합니다. 녹음 파일은 저장되지 않습니다." (실제 동작과 일치하도록 작성)

2. **Android 권한 오버그랜트 검토**
   - `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` / `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` 등이 트레이너 기능과 무관
   - 다만 음악 라이브러리(`expo-media-library`)가 요구하는 권한이라 이번 스프린트에서 제거하면 기존 기능 깨짐
   - **권고**: 트레이너만의 이슈는 아니지만, `READ_MEDIA_AUDIO`만 남기고 나머지는 SDK 33+ 대응으로 단계적 정리 (별도 스프린트)

3. **mic-test 녹음 파일 디스크 저장 여부 확인**
   - `RecordingPresets.HIGH_QUALITY`로 `prepareToRecordAsync()` 호출 시 임시 wav가 디스크에 생성될 수 있음
   - cleanup에서 `recorder.stop()`은 하지만 생성된 파일 삭제 명시 없음
   - **수정안**: `recorder.uri` 확인 후 `FileSystem.deleteAsync(uri, { idempotent: true })`로 명시적 삭제

### 🟡 권장 조치
- `useTrainerMicSession` cleanup의 비동기 직렬화 — 현재 `void async IIFE`라 다음 화면 진입과 race 가능. 다만 동일 모듈을 거치니 큰 문제 아님
- `vocalRange` 평문 저장은 비민감(MIDI 정수)이므로 OK. 향후 pitch 기록/녹음 메타 추가 시 암호화 필요

### 👍 잘된 점
- WAV 캐시가 앱 전용 `cacheDirectory`에 한정 — 타 앱 접근 불가
- `NSMicrophoneUsageDescription`과 expo-audio plugin 텍스트가 일치
- 화면 이탈 시 `allowsRecording: false` 원복으로 AVAudioSession 누수 차단
- AsyncStorage 버전 관리 + migrate 함수 체계적

---

## 3. 단위 테스트 (jest-expo, 신규)

설정: `package.json` → `"test": "jest"`, `"jest": { "preset": "jest-expo", ... }`

| 파일 | 테스트 수 | 검증 항목 |
|---|---|---|
| `lib/trainer/__tests__/notes.test.ts` | 21 | MIDI↔Hz 라운드트립, midiToNote, vocalizeScaleUpDown, centsBetween, noteNameKoBase, 트레이너 상수 |
| `lib/trainer/__tests__/sine-wav.test.ts` | 6 | 메모이즈 hit, 다른 MIDI별 파일 분리, LRU 50 evict, 재참조 시 LRU 갱신, 주파수→MIDI 양자화 일관성 |

실행: `npm test` (또는 `npx jest lib/trainer`).

---

## 4. 빌드 / 실기기 체크리스트 (VOCAL_TRAINER.md §8 후속)

### 정적 검증 — 완료
- [x] `tsc --noEmit` 클린 (트레이너 영역 0 에러)
- [x] `expo lint` 클린
- [x] `npm test` 27/27 통과

### 네이티브 빌드 — 미완료, 사용자 머신에서 진행 필요
expo-audio가 새로 추가됐으므로 Android는 클린 리빌드 필수.

```bash
# 옵션 A — 가장 깨끗한 방법 (권장)
npx expo prebuild --clean
npm run android   # 또는 npm run ios

# 옵션 B — 기존 prebuild 유지하고 gradle만 클린
cd android && ./gradlew clean && cd ..
npm run android
```

iOS는 Pods 갱신 필요:
```bash
cd ios && pod install && cd ..
npm run ios
```

### 실기기 동작 확인 — 미완료
- [ ] 트레이너 탭이 보이고 카드 3개 모두 클릭 가능
- [ ] 마이크 권한 다이얼로그 → 허용 → 레벨바가 발성에 반응 (회색→녹색→빨강 색 전환)
- [ ] 음역대 측정: C4 사인파 재생 → "낼 수 있음/못 냄" 응답마다 한 반음 이동
- [ ] 측정 완료 시 결과 화면에 최저/최고 + 옥타브 수 표시되고 store에 저장
- [ ] 스케일 연습: 9음(도-레-미-파-솔-파-미-레-도) 순차 재생, 현재 음 카드 강조
- [ ] ± 버튼으로 키 조정 시 user touched 가드 동작 (store 변경에 안 덮임)
- [ ] 음악 재생 중 트레이너 진입 시 자동 일시정지, 트레이너 이탈 후에도 자동 재개 X
- [ ] 헤드셋/Bluetooth 연결 환경에서도 동일 동작
- [ ] 마이크 화면 이탈 후 다른 화면에서 음악 재생이 정상 (AVAudioSession 원복 확인)

### 보안 리뷰 후속 조치 — 미완료
- [ ] `app.json` `NSMicrophoneUsageDescription` + expo-audio `microphonePermission` 텍스트를 사용자 친화적으로 갱신
- [ ] mic-test cleanup에서 임시 녹음 파일 삭제 코드 추가 (`recorder.uri` 활용)

---

## 5. 한 줄 종합

**1차 리뷰 P0/P1/P2 모두 적용 완료, 단위 테스트 27건 통과, 보안 리뷰 후속 3건(mic 권한 텍스트, 권한 오버그랜트 검토, 녹음 파일 정리)만 정리하면 production 배포 권장 수준.**
