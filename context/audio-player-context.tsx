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
  // 5초 이내면 이전 트랙, 5초 이후면 현재 곡 처음부터.
  playPrev: () => void;
  // 현재 위치 기준으로 상대 시킹. 음수면 뒤로, 양수면 앞으로.
  skipBy: (deltaMs: number) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue>({
  togglePlay: () => {},
  seekTo: () => {},
  playPrev: () => {},
  skipBy: () => {},
});

// 5초 이내에 "이전" 버튼을 누르면 진짜 이전 곡으로,
// 5초 이후에 누르면 현재 곡을 처음부터 다시 재생한다.
const SMART_PREV_THRESHOLD_MS = 5000;

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
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const pendingSeekPosition = usePlayerStore((s) => s.pendingSeekPosition);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setPosition = usePlayerStore((s) => s.setPosition);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const addToRecentlyPlayed = usePlayerStore((s) => s.addToRecentlyPlayed);
  const incrementTrackPlayCount = usePlayerStore((s) => s.incrementTrackPlayCount);
  const savePlaybackState = usePlayerStore((s) => s.savePlaybackState);
  const clearPendingSeekPosition = usePlayerStore((s) => s.clearPendingSeekPosition);

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

  const playbackRate = usePlayerStore((s) => s.playbackRate);
  useEffect(() => {
    void safeTrackPlayerCall('setRate', async () => {
      await ensurePlayerSetup();
      await TrackPlayer.setRate(playbackRate);
    });
  }, [ensurePlayerSetup, playbackRate]);

  // A-B 구간 반복: position이 loopEnd를 넘으면 loopStart로 자동 시킹.
  const loopStart = usePlayerStore((s) => s.loopStart);
  const loopEnd = usePlayerStore((s) => s.loopEnd);
  useEffect(() => {
    if (loopStart === null || loopEnd === null) return;
    // 안전장치: 비정상적으로 짧은 구간이 설정된 경우(예: 데이터 손상) 무시.
    // UI에서는 1초 가드를 두지만 스토어를 직접 조작하는 케이스에 대한 방어.
    if (loopEnd - loopStart < 500) return;
    const positionMs = (progress.position ?? 0) * 1000;
    if (positionMs >= loopEnd) {
      void safeTrackPlayerCall('loopAB', async () => {
        await TrackPlayer.seekTo(loopStart / 1000);
        usePlayerStore.getState().setPosition(loopStart);
      });
    }
  }, [progress.position, loopStart, loopEnd]);

  // 트랙이 바뀌면 A-B 마커는 해제 (서로 다른 곡에서 의미 없음).
  useEffect(() => {
    if (!currentTrack) return;
    const store = usePlayerStore.getState();
    if (store.loopStart !== null || store.loopEnd !== null) {
      store.clearLoop();
    }
  }, [currentTrack?.id]);

  // 슬립 타이머: 만료 시각에 도달하면 정지 + 타이머 클리어
  const sleepTimerEndAt = usePlayerStore((s) => s.sleepTimerEndAt);
  useEffect(() => {
    if (sleepTimerEndAt === null) return;

    const remainingMs = sleepTimerEndAt - Date.now();
    if (remainingMs <= 0) {
      usePlayerStore.getState().setSleepTimerMinutes(null);
      void safeTrackPlayerCall('sleepTimerExpireNow', async () => {
        await TrackPlayer.pause();
      });
      return;
    }

    const timeoutId = setTimeout(() => {
      usePlayerStore.getState().setSleepTimerMinutes(null);
      void safeTrackPlayerCall('sleepTimerExpire', async () => {
        await TrackPlayer.pause();
      });
    }, remainingMs);

    return () => clearTimeout(timeoutId);
  }, [sleepTimerEndAt]);

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

  useTrackPlayerEvents([Event.PlaybackActiveTrackChanged], (event) => {
    if (typeof event.index !== 'number') {
      return;
    }

    const store = usePlayerStore.getState();
    if (event.index !== store.currentIndex) {
      store.setCurrentIndex(event.index);
    }
  });

  useTrackPlayerEvents([Event.PlaybackError], (event) => {
    console.warn('[AudioPlayer] PlaybackError', event);
    // playback-service가 자동으로 다음 곡 스킵을 시도하지만,
    // 스킵 전까지 UI가 재생 중처럼 보이지 않도록 즉시 정지 상태로 동기화.
    usePlayerStore.getState().setIsPlaying(false);
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

  // 마지막 재생 위치를 주기적으로 AsyncStorage에 저장한다.
  // 배터리 절약: 인터벌을 5초 -> 15초로 늘리고, 앱이 백그라운드로 가면
  // 즉시 한 번 저장 후 인터벌을 멈춘다. 포그라운드 복귀 시 다시 시작.
  // 화면이 꺼진 채로 재생 중일 때 발생하던 720회/h -> 0회/h 디스크 IO.
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startInterval = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        savePlaybackState(latestProgressRef.current * 1000);
      }, 15000);
    };

    const stopInterval = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    if (AppState.currentState === 'active') {
      startInterval();
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startInterval();
      } else {
        // 백그라운드 진입 직전에 한 번 저장해 위치 손실을 최소화.
        savePlaybackState(latestProgressRef.current * 1000);
        stopInterval();
      }
    });

    return () => {
      stopInterval();
      subscription.remove();
    };
  }, [isPlaying, savePlaybackState]);

  const togglePlay = useCallback(() => {
    void safeTrackPlayerCall('togglePlay', async () => {
      await ensurePlayerSetup();
      const state = await TrackPlayer.getPlaybackState();
      if (isPlaybackActive(state.state)) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    });
  }, [ensurePlayerSetup]);

  const seekTo = useCallback((positionMs: number) => {
    void safeTrackPlayerCall('seekTo', async () => {
      await TrackPlayer.seekTo(positionMs / 1000);
    });
  }, []);

  const playPrev = useCallback(() => {
    void safeTrackPlayerCall('playPrev', async () => {
      await ensurePlayerSetup();
      const { position } = await TrackPlayer.getProgress();
      const positionMs = (position ?? 0) * 1000;

      if (positionMs > SMART_PREV_THRESHOLD_MS) {
        // 현재 곡을 처음부터 다시 재생.
        await TrackPlayer.seekTo(0);
        usePlayerStore.getState().setPosition(0);
        return;
      }

      // 진짜 이전 트랙으로 이동.
      usePlayerStore.getState().playPrev();
    });
  }, [ensurePlayerSetup]);

  const skipBy = useCallback((deltaMs: number) => {
    void safeTrackPlayerCall('skipBy', async () => {
      await ensurePlayerSetup();
      const { position, duration } = await TrackPlayer.getProgress();
      const currentSec = position ?? 0;
      const totalSec = duration ?? 0;
      const targetSec = currentSec + deltaMs / 1000;
      // 트랙 범위를 벗어나지 않도록 클램프.
      const clampedSec = Math.max(0, totalSec > 0 ? Math.min(targetSec, totalSec) : targetSec);
      await TrackPlayer.seekTo(clampedSec);
      usePlayerStore.getState().setPosition(clampedSec * 1000);
    });
  }, [ensurePlayerSetup]);

  return (
    <AudioPlayerContext.Provider value={{ togglePlay, seekTo, playPrev, skipBy }}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioControl() {
  return useContext(AudioPlayerContext);
}
