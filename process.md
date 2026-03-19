# Process

## 2026-03-19

- `favorites` / `recentlyPlayed` 조회 기준을 현재 `queue`에서 전체 라이브러리로 변경했다.
- `use-media-library`에서 불러온 트랙 목록을 전역 스토어의 `libraryTracks`에 동기화하도록 추가했다.
- 플레이리스트 상세 화면에서 `libraryTracks`를 우선 사용해 즐겨찾기와 최근 재생 목록을 구성하도록 수정했다.
- 마지막 재생 상태 복원을 위해 `restoreQueue`와 `pendingSeekPosition`을 추가했다.
- 앱 시작 시 저장된 `lastQueue`, `lastTrackIndex`, `lastPosition`을 사용해 복원하도록 루트 초기화 로직을 수정했다.
- 오디오가 실제 로드된 뒤 저장된 위치로 `seek`한 다음 재생을 이어가도록 오디오 컨텍스트를 수정했다.
- 곡 변경 시 이전 곡의 `lastPosition`이 잘못 남지 않도록 `setQueue`, `setCurrentIndex`, `playNext`, `playPrev`에서 위치 초기화를 정리했다.
- 검증은 `npm run lint`로 수행했고 통과했다.
