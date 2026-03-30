import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore, useCurrentTrack, Track } from '@/store/player-store';
import { TrackItem } from '@/components/track-item';

const SPECIAL_PLAYLISTS: Record<string, { name: string; icon: string; color: string }> = {
  favorites: { name: '즐겨찾기', icon: 'heart', color: '#e74c3c' },
  'recently-played': { name: '최근 재생', icon: 'time', color: '#3498db' },
};

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentTrack = useCurrentTrack();
  const {
    libraryTracks, queue, favorites, recentlyPlayed, playlists,
    setQueue, setIsPlaying, removeTrackFromPlaylist, toggleFavorite,
  } = usePlayerStore();

  const isCustomPlaylist = !SPECIAL_PLAYLISTS[id];
  const trackSource = libraryTracks.length > 0 ? libraryTracks : queue;

  // 트랙 목록 구성
  const getTracks = (): Track[] => {
    if (id === 'favorites') {
      return favorites
        .map((trackId) => trackSource.find((track) => track.id === trackId))
        .filter(Boolean) as Track[];
    }
    if (id === 'recently-played') {
      return recentlyPlayed
        .map((tid) => trackSource.find((track) => track.id === tid))
        .filter(Boolean) as Track[];
    }
    const playlist = playlists.find((p) => p.id === id);
    if (!playlist) return [];
    return playlist.tracks;
  };

  const tracks = getTracks();
  const special = SPECIAL_PLAYLISTS[id];
  const customPlaylist = playlists.find((p) => p.id === id);
  const name = special?.name ?? customPlaylist?.name ?? '플레이리스트';
  const iconName = special?.icon ?? 'list';
  const iconColor = special?.color ?? '#9b59b6';

  const handlePlay = (index: number) => {
    setQueue(tracks, index);
    setIsPlaying(true);
  };

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    setQueue(tracks, 0);
    setIsPlaying(true);
  };

  const handleRemove = (track: Track) => {
    if (id === 'favorites') {
      Alert.alert('즐겨찾기 제거', `"${track.title}"을 즐겨찾기에서 제거할까요?`, [
        { text: '취소', style: 'cancel' },
        { text: '제거', style: 'destructive', onPress: () => toggleFavorite(track.id) },
      ]);
      return;
    }
    Alert.alert('곡 제거', `"${track.title}"을 플레이리스트에서 제거할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '제거', style: 'destructive',
        onPress: () => removeTrackFromPlaylist(id, track.id),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.heroSection}>
        <View style={styles.heroIcon}>
          <Ionicons name={iconName as any} size={48} color={iconColor} />
        </View>
        <Text style={styles.heroName}>{name}</Text>
        <Text style={styles.heroCount}>{tracks.length}곡</Text>

        {tracks.length > 0 && (
          <TouchableOpacity style={styles.playAllBtn} onPress={handlePlayAll}>
            <Ionicons name="play" size={18} color="#000" />
            <Text style={styles.playAllText}>전체 재생</Text>
          </TouchableOpacity>
        )}
      </View>

      {tracks.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name={id === 'favorites' ? 'heart-outline' : id === 'recently-played' ? 'time-outline' : 'list-outline'}
              size={42}
              color="#5f6d8c"
            />
          </View>
          <Text style={styles.emptyTitle}>
            {id === 'favorites'
              ? '아직 즐겨찾기한 곡이 없습니다'
              : id === 'recently-played'
              ? '최근 재생 기록이 비어 있습니다'
              : '플레이리스트가 비어 있습니다'}
          </Text>
          <Text style={styles.emptyText}>
            {id === 'favorites'
              ? '즐겨찾기에 추가된 곡이 없습니다\n트랙의 ♡ 버튼을 눌러 추가하세요'
              : id === 'recently-played'
              ? '아직 재생한 곡이 없습니다'
              : '이 플레이리스트에 곡이 없습니다'}
          </Text>
          <TouchableOpacity style={styles.emptyActionBtn} onPress={() => router.push('/library')}>
            <Text style={styles.emptyActionText}>라이브러리에서 곡 보기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <View style={styles.trackRow}>
              <View style={styles.trackItemWrap}>
                <TrackItem
                  track={item}
                  isActive={currentTrack?.id === item.id}
                  onPress={() => handlePlay(index)}
                />
              </View>
              {/* 즐겨찾기 또는 커스텀 플레이리스트에서만 삭제 버튼 표시 */}
              {(isCustomPlaylist || id === 'favorites') && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemove(item)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={18} color="#555" />
                </TouchableOpacity>
              )}
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  backBtn: { padding: 16 },
  heroSection: { alignItems: 'center', paddingBottom: 24, gap: 8 },
  heroIcon: {
    width: 100, height: 100, borderRadius: 16,
    backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  heroName: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  heroCount: { color: '#888', fontSize: 14 },
  playAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1DB954', paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 24, marginTop: 8,
  },
  playAllText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 28,
    gap: 12,
    borderRadius: 24,
    backgroundColor: '#171a18',
    borderWidth: 1,
    borderColor: '#232825',
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 20,
    backgroundColor: '#14171d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: '#727884',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyActionBtn: {
    marginTop: 4,
    backgroundColor: '#1DB954',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  emptyActionText: {
    color: '#071109',
    fontSize: 14,
    fontWeight: '800',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  trackItemWrap: { flex: 1 },
  removeBtn: {
    padding: 8,
  },
});
