import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCurrentTrack, usePlayerStore } from '@/store/player-store';
import { useAudioControl } from '@/hooks/use-audio-player';
import { ProgressBar } from '@/components/player/progress-bar';
import { Controls } from '@/components/player/controls';

export default function PlayerScreen() {
  const currentTrack = useCurrentTrack();
  const { isPlaying, position, duration, playNext, playPrev } = usePlayerStore();
  const { togglePlay, seekTo } = useAudioControl();

  if (!currentTrack) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.empty}>
          <Ionicons name="musical-notes-outline" size={64} color="#555" />
          <Text style={styles.emptyText}>재생 중인 곡이 없습니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
        <Ionicons name="chevron-down" size={28} color="#fff" />
      </TouchableOpacity>

      {/* 앨범 아트 */}
      <View style={styles.artwork}>
        <Ionicons name="musical-note" size={80} color="#1DB954" />
      </View>

      {/* 트랙 정보 */}
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>{currentTrack.title}</Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {currentTrack.artist ?? '알 수 없는 아티스트'}
        </Text>
      </View>

      {/* 진행 바 */}
      <ProgressBar position={position} duration={duration} onSeek={seekTo} />

      {/* 컨트롤 */}
      <Controls
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onPrev={playPrev}
        onNext={playNext}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 24,
    gap: 24,
  },
  closeBtn: {
    alignSelf: 'center',
  },
  artwork: {
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  trackInfo: {
    gap: 4,
  },
  trackTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  trackArtist: {
    color: '#888',
    fontSize: 16,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    color: '#555',
    fontSize: 16,
  },
});
