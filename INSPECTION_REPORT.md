# 점검 & 수정 보고서

작성일: 2026-04-30
대상: music-player (Expo / React Native)
점검자: Cowork agents (Explore + 직접 분석)

---

## 요약

총 **5건의 버그/실행 이슈**를 발견해 모두 수정했습니다. TypeScript 컴파일 에러 0건, ESLint 에러 0건(기존 경고 2건만 잔존, 의도적 의존성 배열). 사용자께서 언급하신 **"알람패널에서 버튼이 안 나오는 현상"** 의 가장 유력한 원인을 `BottomSheetModal portal vs. Stack modal` 충돌로 식별해 수정했습니다.

---

## 수정 내역

### 1. `app/player.tsx` — 풀스크린 플레이어의 슬립타이머/속도 시트 버튼이 안 보이는 버그
**증상**: 플레이어 화면에서 "타이머" 또는 속도 칩을 눌러도 시트 버튼이 안 보이거나 탭이 먹지 않음.

**원인**:
`player` 라우트는 `_layout.tsx`에서 `presentation: 'modal'`로 띄워지는 native modal 스크린입니다. 반면 `OptionsSheetModal`(`@gorhom/bottom-sheet`)은 root `BottomSheetModalProvider`로 portal 렌더되는데, 이때 시트가 modal viewcontroller **뒤로** 깔려서 보이지 않거나 터치가 안 먹는 알려진 충돌이 발생합니다.

**수정**:
- 플레이어 화면을 자체 `BottomSheetModalProvider`로 감싸 시트가 화면 위로 올라오도록 함
- 가독성을 위해 두 개의 `OptionsSheetModal`을 `ScrollView` 콘텐츠 밖, `SafeAreaView` 직속으로 이동
- `ScrollView`에 `style={{ flex: 1 }}` 추가 — 작은 화면에서도 잔여 영역 스크롤 보장

### 2. `app/player.tsx` — 화면이 큰 콘텐츠인데 스크롤이 안 되는 보조적 보강
**원인**: `ScrollView`가 `style` 없이 `contentContainerStyle`만 사용. 부모(`SafeAreaView`)가 flex:1이지만 일부 Android 빌드/디바이스에서 ScrollView가 0높이로 측정되어 스크롤 불가.

**수정**: 위 1번에서 함께 적용 (`styles.scroll = { flex: 1 }`).

### 3. `components/mini-player.tsx` — 미니플레이어 아래로 스와이프 시 큐 전체가 사라지는 파괴적 동작
**증상**: 미니플레이어를 아래로 스와이프하면 재생 큐가 통째로 비워지고 재생이 멈춤. 사용자는 "닫기"를 의도했지만 실제로는 곡 목록이 사라짐.

**원인**: `handleSwipe` 의 `case 'down': clearQueue(); break;` — 재생 가능한 큐 전체와 lastQueue까지 모두 삭제.

**수정**: 아래 방향 스와이프를 무시하도록 변경. 이제 좌(다음곡)/우(이전곡)/위(풀스크린) 만 동작. 미니플레이어를 비우려면 큐 화면의 휴지통 버튼을 명시적으로 눌러야 함.

### 4. `components/player/controls.tsx` — 반복(Repeat) 아이콘 로직 비일관성
**증상**:
| 상태 | 기존 (controls) | 의도 (player.tsx 헤더) |
|---|---|---|
| off | filled grey | outline grey |
| all | filled green | filled green |
| one | **outline green** | filled green |

같은 화면에 같은 의미의 두 토글 버튼이 다르게 보였고, off 상태가 filled여서 "꺼져있음"이 직관적으로 인지되지 않음.

**수정**:
- 매핑 통일: off → outline, all/one → filled
- `one` 상태는 filled + 우상단 "1" 배지로 `all`과 시각적 구분
- `usePlayerStore()` 전체 구독 → 셀렉터 4개로 분리 (불필요한 리렌더 제거)

### 5. `app/(tabs)/playlists.tsx` — `FlatList renderItem={null}` + 가상화 미작동
**증상**:
- `data={[]}`로 빈 배열을 넘기고 모든 플레이리스트를 `ListFooterComponent` 안에서 `.map()`으로 렌더 → **가상화가 적용되지 않아** 플레이리스트가 많아질수록 성능 저하
- `renderItem={null}`은 RN 타입상 허용은 되지만 비표준 패턴
- `<Modal>`에 `onRequestClose` 누락 → Android 뒤로가기 키로 모달 닫기 불가

**수정**:
- `data={playlists}`, `keyExtractor={(item) => item.id}`, `renderItem={...}` 형태로 정상화
- 자동 생성 항목(즐겨찾기/최근 재생)은 `ListHeaderComponent`로 유지
- 빈 상태는 `ListEmptyComponent`로 분리
- 생성 모달에 `onRequestClose` 핸들러 추가 (이름 입력 초기화 + 닫기)
- `usePlayerStore()` 전체 구독 → 셀렉터로 잘게 분리

---

## 검증

```
npx tsc --noEmit --skipLibCheck
→ 실제 앱 영역(app/, components/, hooks/, context/, store/, services/) 0 errors
→ app-example/ 폴더 에러는 Expo 템플릿 잔재로 무관

npx eslint app/ components/ hooks/ context/ store/ services/
→ 0 errors, 2 warnings (audio-player-context.tsx의 의도된 deps 패턴, 기존 코드)
```

---

## 변경 파일 목록

| 파일 | 변경 |
|---|---|
| `app/player.tsx` | `BottomSheetModalProvider` import 추가, 화면을 provider로 감싸기, 시트를 ScrollView 밖으로 이동, `scroll` 스타일 추가 |
| `components/mini-player.tsx` | `clearQueue` 의존성 제거, swipe-down 동작 무시 처리 |
| `components/player/controls.tsx` | 반복 아이콘 매핑 통일, "1" 배지 추가, 셀렉터화 |
| `app/(tabs)/playlists.tsx` | FlatList 정상화 (data/renderItem/ListEmptyComponent), Modal `onRequestClose` 추가, 셀렉터화 |

---

## 점검했지만 수정하지 않은 항목

| 항목 | 사유 |
|---|---|
| `(tabs)/index.tsx`, `track-options-modal.tsx`, `playlist/[id].tsx`의 `usePlayerStore()` 전체 구독 | 동작상 버그가 아닌 성능 패턴 이슈. 별도 PR로 일괄 정리 권장 |
| `audio-player-context.tsx` 의 `react-hooks/exhaustive-deps` 경고 2건 | 기존 코드, `currentTrack?.id`만 의도적으로 의존하는 패턴. 의도된 경고 |
| 알람(Alarm) 기능 자체 | 코드베이스에 별도 alarm 시스템은 존재하지 않음. 가장 유사한 "슬립 타이머 패널"의 버튼 버그를 #1번에서 수정 |
| `(tabs)/playlists.tsx`의 `<Modal>`을 `TextInputModal` 컴포넌트로 통일 | 리팩터링 범주, 동작 영향 없음 |

---

## 권장 후속 조치

1. **셀렉터화 일괄 적용**: `(tabs)/index.tsx`, `track-options-modal.tsx`, `playlist/[id].tsx`도 `usePlayerStore((s) => ...)` 셀렉터 패턴으로 전환
2. **`app-example/` 폴더 삭제**: tsc 오류 노이즈 + 빌드 산출물에 포함될 위험
3. **iOS/Android 실기 테스트**: 특히 #1(슬립타이머 시트) 수정은 iOS의 modal stack-up 동작에 의존하므로 실기에서 한 번 확인 권장
