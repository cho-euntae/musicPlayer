import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  RepeatMode,
  State,
  type Track as RNTPTrack,
  usePlaybackState,
  useProgress,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import { useCurrentTrack, usePlayerStore, type Track as PlayerTrack } from '@/store/player-store';

interface AudioPlayerContextValue {
  togglePlay: () => void;
  seekTo: (positionMs: number) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue>({
  togglePlay: () => {},
  seekTo: () => {},
});

const PLAYER_CAPABILITIES = [
  Capability.Play,
  Capability.Pause,
  Capability.SeekTo,
  Capability.SkipToNext,
  Capability.SkipToPrevious,
] as const;

function isPlayerNotInitialized(error: unknown) {
  return String(error).includes('player is not initialized');
}

function isPlaybackActive(state: State | undefined) {
  return state === State.Playing || state === State.Buffering;
}

function logTrackPlayerError(scope: string, error: unknown) {
  console.error(`[AudioPlayer] ${scope}`, error);
}

async function safeTrackPlayerCall(scope: string, task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    logTrackPlayerError(scope, error);
  }
}

function mapRepeatMode(mode: 'off' | 'all' | 'one') {
  switch (mode) {
    case 'all':
      return RepeatMode.Queue;
    case 'one':
      return RepeatMode.Track;
    default:
      return RepeatMode.Off;
  }
}

function toTrackPlayerTrack(track: PlayerTrack) {
  return {
    id: track.id,
    url: track.uri,
    title: track.title,
    artist: track.artist ?? '알 수 없는 아티스트',
    album: track.album,
    artwork: track.artwork,
    duration: track.duration / 1000,
  };
}

function fromTrackPlayerTrack(track: RNTPTrack): PlayerTrack {
  return {
    id: String(track.id),
    uri: track.url,
    title: track.title ?? '알 수 없는 제목',
    artist: track.artist ?? '알 수 없는 아티스트',
    album: typeof track.album === 'string' ? track.album : undefined,
    duration: Math.round((track.duration ?? 0) * 1000),
    artwork: typeof track.artwork === 'string' ? track.artwork : undefined,
  };
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const currentTrack = useCurrentTrack();
  const {
    queue,
    currentIndex,
    isPlaying,
    repeatMode,
    setIsPlaying,
    setPosition,
    setDuration,
    addToRecentlyPlayed,
    incrementTrackPlayCount,
    savePlaybackState,
    pendingSeekPosition,
    clearPendingSeekPosition,
  } = usePlayerStore();

  const playbackState = usePlaybackState();
  const progress = useProgress(1000);
  const setupPromiseRef = useRef<Promise<void> | null>(null);
  const syncedQueueSignatureRef = useRef('');
  const latestProgressRef = useRef(0);
  const lastCountedTrackIdRef = useRef<string | null>(null);
  const queueSignature = queue.map((track) => `${track.id}:${track.uri}`).join('|');

  const ensurePlayerSetup = useCallback(async () => {
    if (!setupPromiseRef.current) {
      setupPromiseRef.current = (async () => {
        try {
          await TrackPlayer.getActiveTrackIndex();
        } catch (error) {
          if (!isPlayerNotInitialized(error)) {
            throw error;
          }

          await TrackPlayer.setupPlayer();
        }

        await TrackPlayer.updateOptions({
          android: {
            appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
            alwaysPauseOnInterruption: true,
          },
          progressUpdateEventInterval: 1,
          capabilities: [...PLAYER_CAPABILITIES],
          notificationCapabilities: [...PLAYER_CAPABILITIES],
          compactCapabilities: [
            Capability.SkipToPrevious,
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
          ],
        });
      })().catch((error) => {
        setupPromiseRef.current = null;
        throw error;
      });
    }

    await setupPromiseRef.current;
  }, []);

  const syncFromTrackPlayer = useCallback(async () => {
    await ensurePlayerSetup();

    const [nativeQueue, activeIndex, currentProgress, currentPlaybackState] = await Promise.all([
      TrackPlayer.getQueue(),
      TrackPlayer.getActiveTrackIndex(),
      TrackPlayer.getProgress(),
      TrackPlayer.getPlaybackState(),
    ]);

    const store = usePlayerStore.getState();

    if (store.queue.length === 0 && nativeQueue.length > 0) {
      const restoredQueue = nativeQueue.map(fromTrackPlayerTrack);
      const restoredIndex = typeof activeIndex === 'number' ? activeIndex : 0;
      const restoredPosition = (currentProgress.position ?? 0) * 1000;

      store.restoreQueue(restoredQueue, restoredIndex, restoredPosition);
      syncedQueueSignatureRef.current = restoredQueue
        .map((track) => `${track.id}:${track.uri}`)
        .join('|');
    }

    if (typeof activeIndex === 'number' && activeIndex !== store.currentIndex) {
      store.setCurrentIndex(activeIndex);
    }

    setPosition((currentProgress.position ?? 0) * 1000);
    setDuration((currentProgress.duration ?? 0) * 1000);
    setIsPlaying(isPlaybackActive(currentPlaybackState.state));
  }, [ensurePlayerSetup, setDuration, setIsPlaying, setPosition]);

  useEffect(() => {
    void safeTrackPlayerCall('ensurePlayerSetup', ensurePlayerSetup);
  }, [ensurePlayerSetup]);

  useEffect(() => {
    latestProgressRef.current = progress.position ?? 0;
    setPosition((progress.position ?? 0) * 1000);
    setDuration((progress.duration ?? 0) * 1000);
  }, [progress.duration, progress.position, setDuration, setPosition]);

  useEffect(() => {
    setIsPlaying(isPlaybackActive(playbackState.state));
  }, [playbackState.state, setIsPlaying]);

  useEffect(() => {
    void safeTrackPlayerCall('setRepeatMode', async () => {
      await ensurePlayerSetup();
      await TrackPlayer.setRepeatMode(mapRepeatMode(repeatMode));
    });
  }, [ensurePlayerSetup, repeatMode]);

  useEffect(() => {
    let isCancelled = false;

    void safeTrackPlayerCall('syncQueue', async () => {
      await ensurePlayerSetup();

      if (isCancelled) {
        return;
      }

      if (queue.length === 0) {
        syncedQueueSignatureRef.current = '';
        await TrackPlayer.reset();
        setPosition(0);
        setDuration(0);
        return;
      }

      const targetIndex = Math.min(currentIndex, queue.length - 1);
      const queueChanged = syncedQueueSignatureRef.current !== queueSignature;

      if (queueChanged) {
        await TrackPlayer.setQueue(queue.map(toTrackPlayerTrack));
        syncedQueueSignatureRef.current = queueSignature;

        const restorePositionSeconds =
          pendingSeekPosition !== null
            ? pendingSeekPosition / 1000
            : latestProgressRef.current;

        await TrackPlayer.skip(targetIndex, restorePositionSeconds);

        if (usePlayerStore.getState().isPlaying) {
          await TrackPlayer.play();
        }

        if (pendingSeekPosition !== null) {
          clearPendingSeekPosition();
        }

        return;
      }

      const activeIndex = await TrackPlayer.getActiveTrackIndex();
      if (activeIndex !== targetIndex) {
        await TrackPlayer.skip(targetIndex, 0);

        if (usePlayerStore.getState().isPlaying) {
          await TrackPlayer.play();
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    clearPendingSeekPosition,
    currentIndex,
    ensurePlayerSetup,
    pendingSeekPosition,
    queue,
    queueSignature,
    setDuration,
    setPosition,
  ]);

  useEffect(() => {
    void safeTrackPlayerCall('syncPlaybackState', async () => {
      await ensurePlayerSetup();

      if (queue.length === 0) {
        return;
      }

      const currentPlaybackState = await TrackPlayer.getPlaybackState();
      const playingNow = isPlaybackActive(currentPlaybackState.state);

      if (isPlaying && !playingNow) {
        await TrackPlayer.play();
      } else if (!isPlaying && playingNow) {
        await TrackPlayer.pause();
      }
    });
  }, [ensurePlayerSetup, isPlaying, queue.length]);

  useTrackPlayerEvents([Event.PlaybackActiveTrackChanged], (event) => {
    if (typeof event.index !== 'number') {
      return;
    }

    const store = usePlayerStore.getState();
    if (event.index !== store.currentIndex) {
      store.setCurrentIndex(event.index);
    }
  });

  useEffect(() => {
    void safeTrackPlayerCall('syncFromTrackPlayer:onMount', syncFromTrackPlayer);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void safeTrackPlayerCall('syncFromTrackPlayer:onActive', syncFromTrackPlayer);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [syncFromTrackPlayer]);

  useEffect(() => {
    if (!currentTrack) {
      lastCountedTrackIdRef.current = null;
      return;
    }

    addToRecentlyPlayed(currentTrack.id);

    if (lastCountedTrackIdRef.current !== currentTrack.id) {
      incrementTrackPlayCount(currentTrack.id);
      lastCountedTrackIdRef.current = currentTrack.id;
    }
  }, [addToRecentlyPlayed, currentTrack?.id, incrementTrackPlayCount]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const interval = setInterval(() => {
      savePlaybackState(latestProgressRef.current * 1000);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPlaying, savePlaybackState]);

  const togglePlay = useCallback(() => {
    const playingNow = usePlayerStore.getState().isPlaying;
    usePlayerStore.getState().setIsPlaying(!playingNow);
  }, []);

  const seekTo = useCallback((positionMs: number) => {
    void safeTrackPlayerCall('seekTo', async () => {
      await TrackPlayer.seekTo(positionMs / 1000);
    });
  }, []);

  return (
    <AudioPlayerContext.Provider value={{ togglePlay, seekTo }}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioControl() {
  return useContext(AudioPlayerContext);
}
