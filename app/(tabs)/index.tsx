import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePlayerStore, useCurrentTrack } from '@/store/player-store';
import { TrackItem } from '@/components/track-item';

export default function HomeScreen() {
  const currentTrack = useCurrentTrack();
  const { queue, setCurrentIndex, setIsPlaying } = usePlayerStore();

  const recentTracks = queue;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Home</Text>

        {currentTrack && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>지금 재생 중</Text>
            <View style={styles.nowPlaying}>
              <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                {currentTrack.title}
              </Text>
              <Text style={styles.nowPlayingArtist} numberOfLines={1}>
                {currentTrack.artist ?? '알 수 없는 아티스트'}
              </Text>
            </View>
          </View>
        )}

        {recentTracks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>재생 목록</Text>
            {recentTracks.map((track, index) => (
              <TrackItem
                key={track.id}
                track={track}
                isActive={currentTrack?.id === track.id}
                onPress={() => {
                  setCurrentIndex(index);
                  setIsPlaying(true);
                }}
              />
            ))}
          </View>
        )}

        {queue.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              Library 탭에서 음악을 선택하면{'\n'}여기에 표시됩니다.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  nowPlaying: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1DB954',
    gap: 4,
  },
  nowPlayingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  nowPlayingArtist: {
    color: '#888',
    fontSize: 14,
  },
  emptyBox: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#555',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
});
