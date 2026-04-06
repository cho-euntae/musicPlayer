import TrackPlayer from 'react-native-track-player';

import playbackService from '@/services/playback-service';

declare global {
  var __musicPlayerTrackServiceRegistered: boolean | undefined;
}

if (!globalThis.__musicPlayerTrackServiceRegistered) {
  TrackPlayer.registerPlaybackService(() => playbackService);
  globalThis.__musicPlayerTrackServiceRegistered = true;
}
