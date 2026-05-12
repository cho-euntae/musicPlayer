import TrackPlayer from 'react-native-track-player';

import playbackService from '@/services/playback-service';

// react-native-track-player의 playback service 등록.
//
// 등록 시점:
//  - index.js의 가장 첫 import 로 호출되어, 메인 RN 컨텍스트가 부팅될 때 1회.
//  - 시스템이 헤드리스 task로 service를 깨울 때 (앱이 죽은 상태에서 알림 액션
//    탭, BT 미디어 버튼 등) RN이 새 JS 컨텍스트를 만들고 entry 부터 다시 import 해
//    이 파일이 다시 로드되며 등록도 다시 일어난다.
//
// 가드를 두지 않는 이유:
//  - 과거에는 globalThis 플래그로 중복 등록을 막았지만, RNTP 4.x 의 헤드리스
//    호출 흐름과 충돌해 BT/시스템 미디어 버튼 액션이 RN listener 까지 전달되지
//    않는 케이스가 있었다.
//  - registerPlaybackService 자체가 같은 이름으로 다시 호출되면 기존 등록을
//    덮어쓰는 idempotent 한 동작이라, 중복 호출은 무해하다.
try {
  TrackPlayer.registerPlaybackService(() => playbackService);
} catch (error) {
  console.error('[TrackPlayer] registerPlaybackService failed', error);
}
