import TrackPlayer, { Event } from 'react-native-track-player';

async function skipToNextTrack() {
  try {
    await TrackPlayer.skipToNext();
  } catch {
    // 재생 큐 마지막 곡에서는 무시
  }
}

async function skipToPreviousTrack() {
  try {
    await TrackPlayer.skipToPrevious();
  } catch {
    // 첫 곡에서는 무시
  }
}

// 알림센터/제어센터/잠금화면/CarPlay 등 시스템 미디어 컨트롤은
// 현재 재생 상태에 맞춰 RemotePlay 또는 RemotePause를 "정확히" 보내준다.
// 따라서 이벤트의 의도(play/pause)를 그대로 따르는 것이 표준 동작이며,
// 그 어떤 race condition도 만들지 않는다.
//
// 과거 시도: 두 이벤트를 모두 "현재 state 기준 토글"로 묶었더니,
//  - iOS Control Center에서 일시정지 버튼이 안 먹는 문제 (AVAudioSession이
//    먼저 상태를 paused로 갱신해 토글이 다시 play를 호출)
//  - Android 알림센터에서도 유사한 race로 버튼 1회 탭이 무시되는 케이스 발생
// 가 있었기 때문에 이벤트별 단일 동작으로 복원한다.
//
// 일부 블루투스 헤드셋이 항상 같은 이벤트만 보내는 케이스는,
// RNTP/OS 미디어 세션 레이어에서 이미 상태에 맞게 normalize 해주므로
// 여기서 추가 토글을 하지 않아도 정상 동작한다.
async function handleRemotePlay() {
  try {
    await TrackPlayer.play();
  } catch (error) {
    console.warn('[TrackPlayer] RemotePlay failed', error);
  }
}

async function handleRemotePause() {
  try {
    await TrackPlayer.pause();
  } catch (error) {
    console.warn('[TrackPlayer] RemotePause failed', error);
  }
}

export default async function playbackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, handleRemotePlay);

  TrackPlayer.addEventListener(Event.RemotePause, handleRemotePause);

  TrackPlayer.addEventListener(Event.RemoteNext, skipToNextTrack);

  TrackPlayer.addEventListener(Event.RemotePrevious, skipToPreviousTrack);

  TrackPlayer.addEventListener(Event.RemoteSeek, async (event) => {
    await TrackPlayer.seekTo(event.position);
  });

  TrackPlayer.addEventListener(Event.PlaybackError, async (error) => {
    console.warn('[TrackPlayer] PlaybackError', error);
    try {
      await TrackPlayer.skipToNext();
    } catch {
      try {
        await TrackPlayer.reset();
      } catch {
        // 무시
      }
    }
  });
}
