import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { usePlayerStore, useCurrentTrack } from '@/store/player-store';

interface AudioPlayerContextValue {
  togglePlay: () => void;
  seekTo: (positionMs: number) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue>({
  togglePlay: () => {},
  seekTo: () => {},
});

// 이미 release된 player에 setActiveForLockScreen 호출 시 충돌 방지
function safeLockScreen(player: ReturnType<typeof useAudioPlayer>, active: boolean, metadata?: { title: string; artist: string }) {
  try {
    if (active && metadata) {
      player.setActiveForLockScreen(true, metadata);
    } else {
      player.setActiveForLockScreen(false);
    }
  } catch {
    // player가 이미 release된 경우 무시
  }
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const currentTrack = useCurrentTrack();
  const {
    isPlaying,
    setIsPlaying,
    setPosition,
    setDuration,
    playNext,
    repeatMode,
    addToRecentlyPlayed,
    savePlaybackState,
  } = usePlayerStore();

  const player = useAudioPlayer(currentTrack ? { uri: currentTrack.uri } : null);
  const status = useAudioPlayerStatus(player);

  // 현재 player를 ref로 추적 (cleanup에서 최신 player 사용)
  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  // 백그라운드 재생 + 오디오 포커스 설정 (앱 시작 시 1회)
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });

    return () => {
      safeLockScreen(playerRef.current, false);
    };
  }, []);

  // 오디오 로드 완료되면 자동 재생 + 락스크린 컨트롤 활성화
  useEffect(() => {
    if (!status.isLoaded) return;

    if (isPlaying && !status.playing) {
      player.play();
    }
    if (currentTrack) {
      safeLockScreen(player, true, {
        title: currentTrack.title,
        artist: currentTrack.artist ?? '알 수 없는 아티스트',
      });
    }
  }, [status.isLoaded]);

  // 진행 시간 / 총 길이 동기화
  useEffect(() => {
    if (status.isLoaded) {
      setDuration(status.duration ? status.duration * 1000 : 0);
      setPosition(status.currentTime ? status.currentTime * 1000 : 0);
    }
  }, [status.currentTime, status.duration]);

  // 실제 재생 상태를 스토어에 반영
  useEffect(() => {
    if (status.isLoaded) {
      setIsPlaying(status.playing);
    }
  }, [status.playing]);

  // 트랙 끝났을 때
  useEffect(() => {
    if (status.didJustFinish) {
      if (repeatMode === 'one') {
        player.seekTo(0);
        player.play();
      } else {
        playNext();
      }
    }
  }, [status.didJustFinish]);

  // 트랙 변경 시 최근 재생 기록 + 락스크린 메타데이터 갱신
  useEffect(() => {
    if (!currentTrack) return;
    addToRecentlyPlayed(currentTrack.id);
    if (status.isLoaded) {
      safeLockScreen(player, true, {
        title: currentTrack.title,
        artist: currentTrack.artist ?? '알 수 없는 아티스트',
      });
    }
  }, [currentTrack?.id]);

  // 재생 위치 주기적 저장 (5초마다)
  useEffect(() => {
    if (!status.playing) return;
    const interval = setInterval(() => {
      if (status.currentTime) {
        savePlaybackState(status.currentTime * 1000);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [status.playing, status.currentTime]);

  const togglePlay = useCallback(() => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [status.playing, player]);

  const seekTo = useCallback(
    (positionMs: number) => {
      player.seekTo(positionMs / 1000);
    },
    [player]
  );

  return (
    <AudioPlayerContext.Provider value={{ togglePlay, seekTo }}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioControl() {
  return useContext(AudioPlayerContext);
}
