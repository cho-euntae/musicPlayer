import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMediaLibrary } from '@/hooks/use-media-library';
import { TrackItem } from '@/components/track-item';
import { usePlayerStore, useCurrentTrack } from '@/store/player-store';

export default function LibraryScreen() {
  const { tracks, isLoading, error, permissionStatus, requestPermission } = useMediaLibrary();
  const currentTrack = useCurrentTrack();
  const { setQueue, setIsPlaying } = usePlayerStore();

  const handlePlay = (index: number) => {
    setQueue(tracks, index);
    setIsPlaying(true);
  };

  if (permissionStatus !== 'granted') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <Ionicons name="musical-notes" size={48} color="#1DB954" />
          <Text style={styles.permissionTitle}>음악 접근 권한 필요</Text>
          <Text style={styles.permissionDesc}>
            기기에 저장된 음악을 재생하려면 미디어 라이브러리 접근 권한이 필요합니다.
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>권한 허용</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1DB954" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
        <Text style={styles.count}>{tracks.length}곡</Text>
      </View>
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <TrackItem
            track={item}
            isActive={currentTrack?.id === item.id}
            onPress={() => handlePlay(index)}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  count: {
    color: '#888',
    fontSize: 14,
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  permissionDesc: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionBtn: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  permissionBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 15,
  },
  error: {
    color: '#ff4444',
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 16,
  },
});
