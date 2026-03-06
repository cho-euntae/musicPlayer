import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCurrentTrack, usePlayerStore } from '@/store/player-store';
import { useAudioControl } from '@/hooks/use-audio-player';

export function MiniPlayer() {
  const currentTrack = useCurrentTrack();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playNext = usePlayerStore((s) => s.playNext);
  const { togglePlay } = useAudioControl();

  if (!currentTrack) return null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push('/player')}
      activeOpacity={0.95}
    >
      <View style={styles.artwork}>
        <Ionicons name="musical-note" size={18} color="#1DB954" />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {currentTrack.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {currentTrack.artist ?? '알 수 없는 아티스트'}
        </Text>
      </View>
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); togglePlay(); }}
        style={styles.btn}
        hitSlop={8}
      >
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); playNext(); }}
        style={styles.btn}
        hitSlop={8}
      >
        <Ionicons name="play-skip-forward" size={22} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
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
  artwork: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
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
