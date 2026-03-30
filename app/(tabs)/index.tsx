import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCurrentTrack, usePlayerStore } from '@/store/player-store';
import { useAudioControl } from '@/context/audio-player-context';
import { TrackItem } from '@/components/track-item';

export default function HomeScreen() {
  const currentTrack = useCurrentTrack();
  const {
    queue,
    currentIndex,
    isPlaying,
    favorites,
    recentlyPlayed,
    libraryTracks,
    setCurrentIndex,
    setIsPlaying,
    playNext,
  } = usePlayerStore();
  const { togglePlay } = useAudioControl();

  const upcomingTracks = queue.slice(currentIndex + 1, currentIndex + 4);
  const favoriteTracks = favorites
    .map((trackId) => libraryTracks.find((track) => track.id === trackId))
    .filter(Boolean)
    .slice(0, 3);
  const recentTracks = recentlyPlayed
    .map((trackId) => libraryTracks.find((track) => track.id === trackId))
    .filter(Boolean)
    .slice(0, 4);

  const handlePlayTrack = (trackId: string) => {
    const index = queue.findIndex((track) => track.id === trackId);
    if (index === -1) return;
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MUSIC PLAYER</Text>
            <Text style={styles.title}>홈</Text>
          </View>
          <TouchableOpacity style={styles.queueShortcut} onPress={() => router.push('/queue')}>
            <Ionicons name="list-outline" size={18} color="#fff" />
            <Text style={styles.queueShortcutText}>큐</Text>
          </TouchableOpacity>
        </View>

        {currentTrack ? (
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.heroBadge}>
                <Ionicons name="volume-high" size={14} color="#0f1110" />
                <Text style={styles.heroBadgeText}>{isPlaying ? '지금 재생 중' : '일시정지됨'}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/player')} hitSlop={8}>
                <Ionicons name="expand-outline" size={20} color="#d6f7df" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroArtwork}>
              <Ionicons name="musical-note" size={54} color="#1DB954" />
            </View>

            <Text style={styles.heroTitle} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.heroArtist} numberOfLines={1}>
              {currentTrack.artist ?? '알 수 없는 아티스트'}
            </Text>

            <View style={styles.heroActions}>
              <TouchableOpacity style={styles.primaryAction} onPress={togglePlay}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#041107" />
                <Text style={styles.primaryActionText}>{isPlaying ? '일시정지' : '재생'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryAction} onPress={playNext}>
                <Ionicons name="play-skip-forward" size={18} color="#fff" />
                <Text style={styles.secondaryActionText}>다음 곡</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyHero}>
            <View style={styles.emptyArtwork}>
              <Ionicons name="musical-notes-outline" size={52} color="#2e6c47" />
            </View>
            <Text style={styles.emptyHeroTitle}>아직 재생 중인 곡이 없습니다</Text>
            <Text style={styles.emptyHeroText}>
              Library에서 곡을 선택하면 홈에서 현재 재생 상태와 큐를 바로 확인할 수 있습니다.
            </Text>
            <TouchableOpacity style={styles.emptyHeroBtn} onPress={() => router.push('/library')}>
              <Text style={styles.emptyHeroBtnText}>라이브러리 열기</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.quickGrid}>
          <TouchableOpacity style={[styles.quickCard, styles.quickCardGreen]} onPress={() => router.push('/queue')}>
            <Ionicons name="list" size={20} color="#d7ffe2" />
            <Text style={styles.quickLabel}>현재 큐</Text>
            <Text style={styles.quickValue}>{queue.length}곡</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickCard, styles.quickCardRed]}
            onPress={() => router.push('/playlist/favorites')}
          >
            <Ionicons name="heart" size={20} color="#ffd6d6" />
            <Text style={styles.quickLabel}>즐겨찾기</Text>
            <Text style={styles.quickValue}>{favorites.length}곡</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickCard, styles.quickCardBlue]}
            onPress={() => router.push('/playlist/recently-played')}
          >
            <Ionicons name="time" size={20} color="#d8ecff" />
            <Text style={styles.quickLabel}>최근 재생</Text>
            <Text style={styles.quickValue}>{recentlyPlayed.length}곡</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickCard, styles.quickCardPurple]}
            onPress={() => router.push('/playlists')}
          >
            <Ionicons name="albums" size={20} color="#ece1ff" />
            <Text style={styles.quickLabel}>플레이리스트</Text>
            <Text style={styles.quickValue}>관리</Text>
          </TouchableOpacity>
        </View>

        {upcomingTracks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>다음 곡</Text>
              <TouchableOpacity onPress={() => router.push('/queue')}>
                <Text style={styles.sectionLink}>전체 보기</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.panel}>
              {upcomingTracks.map((track) => (
                track && (
                  <TrackItem
                    key={track.id}
                    track={track}
                    onPress={() => handlePlayTrack(track.id)}
                  />
                )
              ))}
            </View>
          </View>
        )}

        {recentTracks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>최근 재생</Text>
              <TouchableOpacity onPress={() => router.push('/playlist/recently-played')}>
                <Text style={styles.sectionLink}>열기</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.panel}>
              {recentTracks.map((track) => (
                track && (
                  <TrackItem
                    key={track.id}
                    track={track}
                    isActive={currentTrack?.id === track.id}
                    onPress={() => handlePlayTrack(track.id)}
                  />
                )
              ))}
            </View>
          </View>
        )}

        {favoriteTracks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>즐겨찾기 픽</Text>
              <TouchableOpacity onPress={() => router.push('/playlist/favorites')}>
                <Text style={styles.sectionLink}>열기</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.panel}>
              {favoriteTracks.map((track) => (
                track && (
                  <TrackItem
                    key={track.id}
                    track={track}
                    isActive={currentTrack?.id === track.id}
                    onPress={() => handlePlayTrack(track.id)}
                  />
                )
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1110',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#5d8f6d',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 4,
  },
  queueShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#1a1d1b',
    borderWidth: 1,
    borderColor: '#262b28',
  },
  queueShortcutText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  heroCard: {
    backgroundColor: '#153222',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#24553a',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#b8f5c9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: '#0f1110',
    fontSize: 12,
    fontWeight: '700',
  },
  heroArtwork: {
    width: 120,
    height: 120,
    borderRadius: 20,
    marginTop: 18,
    marginBottom: 18,
    backgroundColor: '#10281b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  heroArtist: {
    color: '#b5cabd',
    fontSize: 15,
    marginTop: 6,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#b8f5c9',
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryActionText: {
    color: '#08110a',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#244433',
    borderRadius: 14,
    paddingVertical: 14,
  },
  secondaryActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyHero: {
    backgroundColor: '#171a18',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#232825',
  },
  emptyArtwork: {
    width: 104,
    height: 104,
    borderRadius: 18,
    backgroundColor: '#121513',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyHeroTitle: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '700',
  },
  emptyHeroText: {
    color: '#7f8a83',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  emptyHeroBtn: {
    alignSelf: 'flex-start',
    marginTop: 16,
    backgroundColor: '#1DB954',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyHeroBtnText: {
    color: '#071109',
    fontSize: 14,
    fontWeight: '800',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '48.5%',
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  quickCardGreen: {
    backgroundColor: '#1b2d23',
  },
  quickCardRed: {
    backgroundColor: '#321c20',
  },
  quickCardBlue: {
    backgroundColor: '#1b2733',
  },
  quickCardPurple: {
    backgroundColor: '#262033',
  },
  quickLabel: {
    color: '#d4d8d5',
    fontSize: 13,
    fontWeight: '600',
  },
  quickValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionLink: {
    color: '#7ec79a',
    fontSize: 13,
    fontWeight: '700',
  },
  panel: {
    backgroundColor: '#171a18',
    borderRadius: 18,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#232825',
  },
});
