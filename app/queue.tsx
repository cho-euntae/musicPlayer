import { useState } from 'react';
import { Alert, View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TrackItem } from '@/components/track-item';
import { useCurrentTrack, usePlayerStore } from '@/store/player-store';
import { TextInputModal } from '@/components/text-input-modal';

export default function QueueScreen() {
  const currentTrack = useCurrentTrack();
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const setCurrentIndex = usePlayerStore((s) => s.setCurrentIndex);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const moveTrackInQueue = usePlayerStore((s) => s.moveTrackInQueue);
  const removeTrackFromQueue = usePlayerStore((s) => s.removeTrackFromQueue);
  const savePlaylistFromTracks = usePlayerStore((s) => s.savePlaylistFromTracks);

  const [saveModalVisible, setSaveModalVisible] = useState(false);

  const handlePlay = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
    router.push('/player');
  };

  const handleRemove = (trackId: string) => {
    removeTrackFromQueue(trackId);
  };

  const handleMove = (fromIndex: number, toIndex: number) => {
    moveTrackInQueue(fromIndex, toIndex);
  };

  const handleClearQueue = () => {
    Alert.alert('재생 큐 비우기', '현재 재생 큐를 모두 비울까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '비우기',
        style: 'destructive',
        onPress: () => {
          clearQueue();
          router.back();
        },
      },
    ]);
  };

  const handleSavePlaylist = (name: string) => {
    savePlaylistFromTracks(name, queue);
    setSaveModalVisible(false);
    Alert.alert('저장 완료', `"${name}" 플레이리스트로 저장했습니다 (${queue.length}곡)`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>현재 재생 큐</Text>
          <Text style={styles.subtitle}>{queue.length}곡</Text>
        </View>
        {queue.length > 0 ? (
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setSaveModalVisible(true)}
              style={styles.headerBtn}
              hitSlop={8}
            >
              <Ionicons name="bookmark-outline" size={20} color="#1DB954" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearQueue} style={styles.headerBtn} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      {queue.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="list-outline" size={56} color="#444" />
          <Text style={styles.emptyTitle}>재생 대기 중인 곡이 없습니다</Text>
          <Text style={styles.emptyText}>라이브러리에서 곡을 선택하면 여기서 순서를 확인할 수 있습니다.</Text>
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const isActive = currentTrack?.id === item.id;

            return (
              <View style={styles.trackRow}>
                <View style={styles.indexWrap}>
                  {isActive ? (
                    <Ionicons name="volume-high" size={18} color="#1DB954" />
                  ) : (
                    <Text style={styles.indexText}>{index + 1}</Text>
                  )}
                </View>

                <View style={styles.trackWrap}>
                  <TrackItem
                    track={item}
                    isActive={isActive}
                    onPress={() => handlePlay(index)}
                  />
                </View>

                <View style={styles.actionsWrap}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleMove(index, index - 1)}
                    disabled={index === 0}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="chevron-up"
                      size={16}
                      color={index === 0 ? '#333' : '#888'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleMove(index, index + 1)}
                    disabled={index === queue.length - 1}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={index === queue.length - 1 ? '#333' : '#888'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleRemove(item.id)}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={18} color={index === currentIndex ? '#1DB954' : '#666'} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TextInputModal
        visible={saveModalVisible}
        title="플레이리스트로 저장"
        description={`현재 재생 큐 ${queue.length}곡이 새 플레이리스트로 저장됩니다.`}
        placeholder="플레이리스트 이름"
        confirmLabel="저장"
        onConfirm={handleSavePlaylist}
        onClose={() => setSaveModalVisible(false)}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerBtn: {
    width: 32,
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerTextWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: '#777',
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 24,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  indexWrap: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  trackWrap: {
    flex: 1,
  },
  actionsWrap: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  actionBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
