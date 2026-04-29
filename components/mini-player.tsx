import { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCurrentTrack, usePlayerStore } from '@/store/player-store';
import { useAudioControl } from '@/context/audio-player-context';
import { TrackArtwork } from '@/components/track-artwork';

// 제스처 인식 임계값.
// 너무 작으면 일반 탭과 충돌하고, 너무 크면 동작이 무겁게 느껴진다.
const SWIPE_DISTANCE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 600;
const ACTIVE_OFFSET = 12;

type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

function detectSwipeDirection(
  translationX: number,
  translationY: number,
  velocityX: number,
  velocityY: number,
): SwipeDirection {
  const absX = Math.abs(translationX);
  const absY = Math.abs(translationY);

  // 거리 또는 속도 중 하나라도 임계값을 넘기면 인식.
  const horizontal =
    absX > absY &&
    (absX >= SWIPE_DISTANCE_THRESHOLD ||
      Math.abs(velocityX) >= SWIPE_VELOCITY_THRESHOLD);
  const vertical =
    absY > absX &&
    (absY >= SWIPE_DISTANCE_THRESHOLD ||
      Math.abs(velocityY) >= SWIPE_VELOCITY_THRESHOLD);

  if (horizontal) {
    return translationX > 0 ? 'right' : 'left';
  }
  if (vertical) {
    return translationY > 0 ? 'down' : 'up';
  }
  return null;
}

export function MiniPlayer() {
  const currentTrack = useCurrentTrack();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playNext = usePlayerStore((s) => s.playNext);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const { togglePlay, playPrev } = useAudioControl();
  const lastHandledRef = useRef(0);

  if (!currentTrack) return null;

  const handleSwipe = (event: PanGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.state !== State.END) return;

    // 같은 제스처가 여러 번 fire되는 케이스 방지 (안전장치).
    const now = Date.now();
    if (now - lastHandledRef.current < 250) return;

    const direction = detectSwipeDirection(
      event.nativeEvent.translationX,
      event.nativeEvent.translationY,
      event.nativeEvent.velocityX,
      event.nativeEvent.velocityY,
    );

    if (!direction) return;

    lastHandledRef.current = now;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    switch (direction) {
      case 'left':
        playNext();
        break;
      case 'right':
        playPrev();
        break;
      case 'up':
        router.push('/player');
        break;
      case 'down':
        // 미니플레이어 닫기: 큐 비우고 재생 정지.
        clearQueue();
        break;
    }
  };

  return (
    <PanGestureHandler
      onHandlerStateChange={handleSwipe}
      activeOffsetX={[-ACTIVE_OFFSET, ACTIVE_OFFSET]}
      activeOffsetY={[-ACTIVE_OFFSET, ACTIVE_OFFSET]}
    >
      <View>
        <TouchableOpacity
          style={styles.container}
          onPress={() => router.push('/player')}
          activeOpacity={0.95}
        >
          <TrackArtwork
            artwork={currentTrack.artwork}
            title={currentTrack.title}
            trackId={currentTrack.id}
            size={38}
            borderRadius={6}
          />
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {currentTrack.artist ?? '알 수 없는 아티스트'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            style={styles.btn}
            hitSlop={8}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              playNext();
            }}
            style={styles.btn}
            hitSlop={8}
          >
            <Ionicons name="play-skip-forward" size={22} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 10,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  info: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    color: '#888',
    fontSize: 12,
  },
  btn: {
    padding: 4,
  },
});
