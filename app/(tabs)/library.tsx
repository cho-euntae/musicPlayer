import { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMediaLibrary } from '@/hooks/use-media-library';
import { TrackItem } from '@/components/track-item';
import { PlaylistPickerModal } from '@/components/playlist-picker-modal';
import { usePlayerStore, useCurrentTrack, Track } from '@/store/player-store';

export default function LibraryScreen() {
  const { tracks, isLoading, error, permissionStatus, requestPermission } = useMediaLibrary();
  const currentTrack = useCurrentTrack();
  const { setQueue, setIsPlaying } = usePlayerStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // 다중 선택
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pickerVisible, setPickerVisible] = useState(false);

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const query = searchQuery.toLowerCase();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        (t.artist ?? '').toLowerCase().includes(query) ||
        (t.album ?? '').toLowerCase().includes(query)
    );
  }, [tracks, searchQuery]);

  const selectedTracks = useMemo(
    () => filteredTracks.filter((t) => selectedIds.has(t.id)),
    [filteredTracks, selectedIds]
  );

  const handlePlay = (index: number) => {
    setQueue(filteredTracks, index);
    setIsPlaying(true);
  };

  const handleLongPress = (track: Track) => {
    setIsSelectMode(true);
    setSelectedIds(new Set([track.id]));
  };

  const handleSelectToggle = (track: Track) => {
    if (!isSelectMode) {
      handlePlay(filteredTracks.indexOf(track));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(track.id)) { next.delete(track.id); } else { next.add(track.id); }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredTracks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTracks.map((t) => t.id)));
    }
  };

  const handleCancelSelect = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleSearchOpen = () => setIsSearching(true);
  const handleSearchClose = () => {
    setIsSearching(false);
    setSearchQuery('');
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
      {/* 헤더 */}
      {isSelectMode ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancelSelect}>
            <Text style={styles.cancelText}>취소</Text>
          </TouchableOpacity>
          <Text style={styles.selectCount}>{selectedIds.size}곡 선택됨</Text>
          <TouchableOpacity onPress={handleSelectAll}>
            <Text style={styles.selectAllText}>
              {selectedIds.size === filteredTracks.length ? '전체 해제' : '전체 선택'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : isSearching ? (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="곡 이름, 아티스트 검색..."
            placeholderTextColor="#555"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          <TouchableOpacity onPress={handleSearchClose} hitSlop={8}>
            <Ionicons name="close" size={20} color="#888" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Library</Text>
            <Text style={styles.count}>{tracks.length}곡</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleSearchOpen} hitSlop={8}>
              <Ionicons name="search" size={22} color="#888" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 트랙 목록 */}
      {filteredTracks.length === 0 && searchQuery.trim() !== '' ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="search-outline" size={44} color="#4d7b5d" />
          </View>
          <Text style={styles.emptyTitle}>&quot;{searchQuery}&quot; 검색 결과가 없습니다</Text>
          <Text style={styles.emptyText}>곡 이름, 아티스트, 앨범명으로 다시 검색해보세요.</Text>
          <TouchableOpacity style={styles.emptyActionBtn} onPress={handleSearchClose}>
            <Text style={styles.emptyActionText}>검색 닫기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredTracks}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <TrackItem
              track={item}
              isActive={!isSelectMode && currentTrack?.id === item.id}
              isSelected={selectedIds.has(item.id)}
              isSelectMode={isSelectMode}
              onPress={() => handleSelectToggle(item)}
              onLongPress={() => handleLongPress(item)}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: isSelectMode ? 80 : 16 }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* 다중 선택 하단 액션 바 */}
      {isSelectMode && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionBtn, selectedIds.size === 0 && styles.actionBtnDisabled]}
            onPress={() => selectedIds.size > 0 && setPickerVisible(true)}
            disabled={selectedIds.size === 0}
          >
            <Ionicons name="add-circle-outline" size={20} color={selectedIds.size > 0 ? '#000' : '#888'} />
            <Text style={[styles.actionBtnText, selectedIds.size === 0 && styles.actionBtnTextDisabled]}>
              플레이리스트에 추가
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 플레이리스트 선택 모달 */}
      <PlaylistPickerModal
        tracks={selectedTracks}
        visible={pickerVisible}
        onClose={() => {
          setPickerVisible(false);
          handleCancelSelect();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  headerRight: { flexDirection: 'row', gap: 16 },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  count: { color: '#888', fontSize: 14 },
  cancelText: { color: '#888', fontSize: 15 },
  selectCount: { color: '#fff', fontSize: 15, fontWeight: '600' },
  selectAllText: { color: '#1DB954', fontSize: 15 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#2a2a2a',
    marginHorizontal: 16, marginVertical: 10,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, padding: 0 },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 24,
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
    backgroundColor: '#111412',
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
    color: '#6f7a73',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
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
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1e1e1e',
    borderTopWidth: 1, borderTopColor: '#2a2a2a',
    padding: 12,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1DB954', borderRadius: 12,
    paddingVertical: 14, gap: 8,
  },
  actionBtnDisabled: { backgroundColor: '#2a2a2a' },
  actionBtnText: { color: '#000', fontSize: 15, fontWeight: 'bold' },
  actionBtnTextDisabled: { color: '#555' },
  permissionBox: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16,
  },
  permissionTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  permissionDesc: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  permissionBtn: {
    backgroundColor: '#1DB954', paddingHorizontal: 32, paddingVertical: 12,
    borderRadius: 24, marginTop: 8,
  },
  permissionBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  error: { color: '#ff4444', textAlign: 'center', marginTop: 40, paddingHorizontal: 16 },
});
