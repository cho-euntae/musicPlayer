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

export default async function playbackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    await TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    await TrackPlayer.pause();
  });

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
