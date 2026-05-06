import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '@/store/player-store';

interface ControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function Controls({ isPlaying, onTogglePlay, onPrev, onNext }: ControlsProps) {
  // 전체 스토어를 구독하면 무관한 상태(예: position) 변화에도 리렌더된다.
  // 셀렉터로 잘게 구독하여 불필요한 리렌더 방지.
  const isShuffled = usePlayerStore((s) => s.isShuffled);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);

  // player.tsx 헤더와 동일한 매핑:
  //  off  → outline (회색)
  //  all  → filled (그린)
  //  one  → filled (그린) + 우상단 "1" 배지로 구분
  const repeatIcon = repeatMode === 'off' ? 'repeat-outline' : 'repeat';
  const repeatColor = repeatMode === 'off' ? '#555' : '#1DB954';

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggleShuffle} hitSlop={8}>
        <Ionicons
          name="shuffle"
          size={24}
          color={isShuffled ? '#1DB954' : '#555'}
        />
      </TouchableOpacity>

      <TouchableOpacity onPress={onPrev} hitSlop={8}>
        <Ionicons name="play-skip-back" size={32} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity onPress={onTogglePlay} style={styles.playBtn}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color="#000" />
      </TouchableOpacity>

      <TouchableOpacity onPress={onNext} hitSlop={8}>
        <Ionicons name="play-skip-forward" size={32} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity onPress={toggleRepeat} hitSlop={8} style={styles.repeatBtn}>
        <Ionicons name={repeatIcon} size={24} color={repeatColor} />
        {repeatMode === 'one' && (
          <View style={styles.repeatOneBadge}>
            <Text style={styles.repeatOneBadgeText}>1</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatBtn: {
    position: 'relative',
    padding: 2,
  },
  repeatOneBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1DB954',
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatOneBadgeText: {
    color: '#041107',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 12,
  },
});
