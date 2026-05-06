import TrackPlayer, { Event, State } from 'react-native-track-player';

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

// 미디어 버튼(블루투스 헤드셋의 Play/Pause 토글, 차량 카오디오 등) 처리.
//
// MediaSession은 보통 현재 상태에 따라 RemotePlay 또는 RemotePause 둘 중 하나만
// 정확히 보내주지만, 헤드셋/스택 조합에 따라 항상 같은 이벤트(예: RemotePause만)
// 가 발생하는 케이스가 있다. 그 경우 단순히 play()/pause()를 부르면 두 번째 탭부터
// 동작이 멈춘 것처럼 보인다(첫 탭으로 일시정지된 뒤 다시 RemotePause가 와도 이미
// 멈춰있어서 변화가 없음).
//
// 두 이벤트 모두 "현재 상태를 보고 토글"하도록 통일하면 모든 BT 기기에서
// 일관되게 동작한다.
async function togglePlayPauseFromRemote() {
  try {
    const { state } = await TrackPlayer.getPlaybackState();
    if (state === State.Playing || state === State.Buffering) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  } catch (error) {
    console.warn('[TrackPlayer] togglePlayPauseFromRemote failed', error);
  }
}

export default async function playbackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, togglePlayPauseFromRemote);

  TrackPlayer.addEventListener(Event.RemotePause, togglePlayPauseFromRemote);

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
