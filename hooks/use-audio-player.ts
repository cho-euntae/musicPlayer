import { useEffect, useRef, useCallback } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { usePlayerStore, useCurrentTrack } from '@/store/player-store';

export function useAudioControl() {
  const currentTrack = useCurrentTrack();
  const { isPlaying, setIsPlaying, setPosition, setDuration, playNext, repeatMode } =
    usePlayerStore();

  const player = useAudioPlayer(currentTrack ? { uri: currentTrack.uri } : null);
  const status = useAudioPlayerStatus(player);

  // 재생 상태 동기화
  useEffect(() => {
    if (status.isLoaded) {
      setDuration(status.duration ? status.duration * 1000 : 0);
      setPosition(status.currentTime ? status.currentTime * 1000 : 0);
    }
  }, [status.currentTime, status.duration]);

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

  // isPlaying 상태 동기화
  useEffect(() => {
    if (status.isLoaded) {
      setIsPlaying(status.playing);
    }
  }, [status.playing]);

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

  // isPlaying 외부 변경 감지 (다른 곡 선택 시)
  useEffect(() => {
    if (isPlaying && status.isLoaded && !status.playing) {
      player.play();
    }
  }, [currentTrack?.id]);

  return { togglePlay, seekTo, player };
}
