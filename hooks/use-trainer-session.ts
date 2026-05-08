import { useCallback, useEffect, useRef } from 'react';
import TrackPlayer from 'react-native-track-player';
import { useFocusEffect } from 'expo-router';

// 트레이너 화면에 들어오면 음악 재생을 일시정지한다.
//
// 정책:
//  - 진입 시 자동 pause. 이미 멈춰있다면 no-op.
//  - 화면을 나가도 자동 재개하지 않는다. 헤드셋/BT 환경에서 자동 재개는
//    사용자를 놀라게 할 수 있고, 미니플레이어로 사용자가 명시적으로 다시
//    재생할 수 있으므로 의도적 수동 동작으로 둔다.
//  - 음악 재생과 마이크 입력이 동시에 들어가는 케이스를 원천 차단해
//    iOS의 AVAudioSession 카테고리 충돌(playback ↔ playAndRecord)을 피한다.
export function useTrainerSession(): void {
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const { state } = await TrackPlayer.getPlaybackState();
          if (state === 'playing' || state === 'buffering') {
            await TrackPlayer.pause();
          }
        } catch {
          // 플레이어가 아직 setup 안 되었을 수도 있음. 무시.
        }
      })();
    }, []),
  );
}

// 화면 안에서 useEffect 의존성을 깔끔하게 쓰기 위한 훅.
// 컴포넌트 언마운트 시 cleanup만 보장해주는 작은 헬퍼.
//
// 구현 메모:
//  - cleanup을 deps에 넣으면 매 렌더마다 함수가 재생성되어 의도치 않은 cleanup
//    호출이 발생한다. 최신 cleanup을 ref로 잡아두고 effect는 빈 deps로 한 번만
//    등록되게 한다.
export function useUnmount(cleanup: () => void): void {
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;
  useEffect(() => () => cleanupRef.current(), []);
}
