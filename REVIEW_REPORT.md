# 보컬 트레이너 코드 리뷰 보고서

- 작성일: 2026-05-08
- 대상: `feat(trainer)` 커밋군 (`fd333f4` ~ `89149ba`)
- 리뷰어 (병렬 점검): TypeScript 리뷰어 / 코드 아키텍트 / 성능 최적화

---

## 점검 범위

| 분류 | 파일 |
|---|---|
| 라우팅 | `app/(tabs)/_layout.tsx`, `app/(tabs)/trainer.tsx`, `app/_layout.tsx` |
| 화면 | `app/trainer/mic-test.tsx`, `app/trainer/range-test.tsx`, `app/trainer/scale-practice.tsx` |
| 훅 | `hooks/use-trainer-session.ts` |
| 도메인 | `lib/trainer/notes.ts`, `lib/trainer/sine-wav.ts` |
| 상태 | `store/player-store.ts` (vocalRange 필드 추가) |
| 설정 | `app.json`, `package.json` |

---

## 종합 우선순위 (3개 리뷰 합본)

### 🔴 P0 — 즉시 수정 권장

1. **`lib/trainer/sine-wav.ts` — 메모이즈 캐시 무한 증가 (성능 + TS)**
   - `memoUriByKey` Map에 LRU/최대치 없음 → 측정 반복 시 누적
   - 또한 키가 `Math.round(frequencyHz * 100)` 기반이라 부동소수점 오차로 같은 음이 다른 키가 될 수 있음
   - **수정안**: 최대 50개 LRU + 키를 MIDI 번호 기반으로 변경 (`sine_${midi}_${durationMs}`)

2. **`app/trainer/scale-practice.tsx:88` — 9음 연속 재생 시 AudioPlayer 인스턴스 정리 race**
   - 매 루프마다 `createAudioPlayer` 새로 만들고 이전 것 제거하는데, 비동기 `remove()` 미완료 상태에서 다음 인스턴스 생성 → JNI 참조 누적 가능
   - **수정안**: `await playerRef.current?.remove()`로 직렬화, 또는 단일 인스턴스 재사용 + `replace(uri)` 패턴

3. **`app/trainer/mic-test.tsx:31` — `useAudioRecorderState(recorder, 50)` 50ms 폴링**
   - 초당 20회 setState → 부모 트리 리렌더, 배터리 소비 큼
   - **수정안**: 100ms로 상향 (육안 감지 한계). 배터리 ~5% 절감 기대

### 🟡 P1 — 가급적 이번 스프린트 안에 정리

4. **`app/trainer/range-test.tsx:105` — `highCandidate` null 처리가 fallback으로 가려짐**
   - `finalize(currentMidi, highCandidate ?? START_MIDI)` 형태라 논리 오류가 런타임에 잡히지 않음
   - **수정안**: 호출 시점에 NonNullable 보장하는 가드, 또는 `setVocalRange`의 swap 의존성 제거

5. **`hooks/use-trainer-session.ts` cleanup 의존성**
   - cleanup이 deps에 들어가면 매 렌더마다 재생성 → 의도치 않은 cleanup 실행
   - **수정안**: cleanup을 `useCallback([], …)`으로 안정화 또는 deps `[]` 고정

6. **격리 정책 문서(§6) vs 실제 코드 불일치 (아키텍트)**
   - VOCAL_TRAINER.md §6은 인덱스 진입 시에만 `TrackPlayer.pause()`로 기술
   - 실제 코드는 인덱스(`trainer.tsx:37`)와 하위 3개 화면 모두에서 `useTrainerSession()` 호출 (defensive)
   - **수정안**: 문서를 "하위 화면 진입 시에도 호출 (redundant but safe)"로 갱신, 또는 코드에서 중복 제거 결정

7. **`app/trainer/mic-test.tsx:60` — `eslint-disable-next-line` 의존성 우회**
   - cleanup이 `recorder.isRecording`을 참조하지만 deps에서 제외
   - **수정안**: `recorderRef`로 안정화하여 명시적 의존성으로 정리

8. **권한 / audio mode 로직 위치 (아키텍트)**
   - 현재 `mic-test.tsx`에만 권한+모드 전환 로직이 있음 → 향후 화면 추가 시 분산 위험
   - **수정안**: `useTrainerMicSession()` 훅으로 추출 또는 `useTrainerSession`에 옵션 통합

### 🟢 P2 — 마이너 / Nit

9. **`app/(tabs)/trainer.tsx` — `router.push('/trainer/...' as never)` 패턴**
   - app.json에 `typedRoutes: true`인데도 `as never`로 우회. 제거하면 자동 타입 검증 회복
10. **`lib/trainer/notes.ts:46-48` — `cMajorScale` 미사용 export**
    - 향후 사용이면 `// TODO: 다양한 스케일 패턴` 주석, 아니면 제거
11. **`app/trainer/scale-practice.tsx:171` — `n.nameKo.replace(/\d$/, '')`**
    - `도4` 형식 가정 → 정규식 의존성. `notes.ts`에 `noteNameKoBase()` 같은 헬퍼 추가가 안전
12. **`store/player-store.ts:497-504` — `setVocalRange` swap 처리**
    - 방어로직은 정확하지만, 호출처에서 low/high 순서 보장 강화하면 swap 자체가 불필요
13. **`useMemo(suggestedRoot)` + `useEffect(setRootMidi, [suggestedRoot])` (scale-practice)**
    - 이중 동기화. state 초기화 로직으로 통합 가능
14. **partialize에 trainer 필드 포함 (아키텍트 의견)**
    - 현재 OK. P2 "진행 기록"으로 확장될 때 별도 `trainer-store` 분리 검토

---

## 잘된 점 (3 리뷰 공통 인정)

- **모듈 경계** — `lib/trainer/*`가 화면 의존 0의 순수 도메인 유틸. 테스트 작성 쉽고 재사용성 높음
- **재생 시스템 격리** — TrackPlayer(`playback`)와 expo-audio(`playAndRecord`) 인스턴스가 완전히 분리. AVAudioSession 충돌 사전 차단
- **세션 권한 원복** — mic-test cleanup에서 `allowsRecording: false` 호출 → iOS 세션 누수 방지
- **WAV 합성 구현** — RIFF 헤더, ADSR fade(20ms), 16-bit PCM mono 모두 정확. 학습용으로 충분
- **MIDI ↔ Hz 변환** — 음악 이론 정확. cent 계산 로직도 추후 pitch 매칭 확장 시 그대로 사용 가능
- **store 마이그레이션** — `partialize` + 버전 관리 체계적, 신규 vocalRange 필드도 정확히 등록

---

## 권장 조치 체크리스트

- [ ] sine-wav.ts: LRU 50개 제한 + MIDI 기반 캐시 키
- [ ] scale-practice.tsx: AudioPlayer 단일 인스턴스 재사용 또는 `await remove()`
- [ ] mic-test.tsx: 폴링 50ms → 100ms
- [ ] range-test.tsx: `highCandidate` 가드 강화
- [ ] use-trainer-session.ts: cleanup deps 고정
- [ ] VOCAL_TRAINER.md §6 표 갱신 (또는 하위 화면 호출 제거)
- [ ] 권한/모드 전환 훅 추출 (`useTrainerMicSession`)
- [ ] `as never` 제거 + `cMajorScale` 처리 결정

---

## 한 줄 종합

**전반 설계와 격리 정책은 견고. P0 3건(메모이즈 LRU·플레이어 인스턴스 race·폴링 주기)만 정리하면 production 배포 권장 수준.**
