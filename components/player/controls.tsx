import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '@/store/player-store';

interface ControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function Controls({ isPlaying, onTogglePlay, onPrev, onNext }: ControlsProps) {
  const { isShuffled, repeatMode, toggleShuffle, toggleRepeat } = usePlayerStore();

  const repeatIcon =
    repeatMode === 'one' ? 'repeat-outline' : 'repeat';
  const repeatColor =
    repeatMode === 'off' ? '#555' : '#1DB954';

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

      <TouchableOpacity onPress={toggleRepeat} hitSlop={8}>
        <Ionicons name={repeatIcon} size={24} color={repeatColor} />
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
});
