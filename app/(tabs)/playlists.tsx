import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { usePlayerStore } from '@/store/player-store';

export default function PlaylistsScreen() {
  const { favorites, recentlyPlayed, playlists, createPlaylist, deletePlaylist } =
    usePlayerStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createPlaylist(name);
    setNewName('');
    setModalVisible(false);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('플레이리스트 삭제', `"${name}"을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deletePlaylist(id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Playlists</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color="#1DB954" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]}
        keyExtractor={() => ''}
        renderItem={null}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* 자동 생성 플레이리스트 */}
            <Text style={styles.sectionTitle}>자동 생성</Text>

            <TouchableOpacity
              style={styles.playlistItem}
              onPress={() => router.push('/playlist/favorites')}
            >
              <View style={[styles.playlistIcon, { backgroundColor: '#3a1a1a' }]}>
                <Ionicons name="heart" size={22} color="#e74c3c" />
              </View>
              <View style={styles.playlistInfo}>
                <Text style={styles.playlistName}>즐겨찾기</Text>
                <Text style={styles.playlistCount}>{favorites.length}곡</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#555" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playlistItem}
              onPress={() => router.push('/playlist/recently-played')}
            >
              <View style={[styles.playlistIcon, { backgroundColor: '#1a2a3a' }]}>
                <Ionicons name="time" size={22} color="#3498db" />
              </View>
              <View style={styles.playlistInfo}>
                <Text style={styles.playlistName}>최근 재생</Text>
                <Text style={styles.playlistCount}>{recentlyPlayed.length}곡</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#555" />
            </TouchableOpacity>

            {/* 커스텀 플레이리스트 */}
            {playlists.length > 0 && (
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>내 플레이리스트</Text>
            )}
          </>
        }
        ListFooterComponent={
          <>
            {playlists.map((playlist) => (
              <TouchableOpacity
                key={playlist.id}
                style={styles.playlistItem}
                onPress={() => router.push(`/playlist/${playlist.id}`)}
                onLongPress={() => handleDelete(playlist.id, playlist.name)}
              >
                <View style={[styles.playlistIcon, { backgroundColor: '#1a1a2a' }]}>
                  <Ionicons name="list" size={22} color="#9b59b6" />
                </View>
                <View style={styles.playlistInfo}>
                  <Text style={styles.playlistName}>{playlist.name}</Text>
                  <Text style={styles.playlistCount}>{playlist.tracks.length}곡</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#555" />
              </TouchableOpacity>
            ))}

            {playlists.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>+ 버튼으로 플레이리스트를 만들어보세요</Text>
              </View>
            )}
          </>
        }
      />

      {/* 플레이리스트 생성 모달 */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>새 플레이리스트</Text>
            <TextInput
              style={styles.input}
              placeholder="이름을 입력하세요"
              placeholderTextColor="#555"
              value={newName}
              onChangeText={setNewName}
              autoFocus
              onSubmitEditing={handleCreate}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setModalVisible(false); setNewName(''); }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleCreate}>
                <Text style={styles.modalConfirmText}>만들기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: '#1DB954',
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: {
    color: '#888', fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 16, marginBottom: 4,
  },
  playlistItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 12,
  },
  playlistIcon: {
    width: 48, height: 48, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  playlistInfo: { flex: 1, gap: 2 },
  playlistName: { color: '#fff', fontSize: 15, fontWeight: '500' },
  playlistCount: { color: '#888', fontSize: 13 },
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: '#444', fontSize: 14 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#1e1e1e', borderRadius: 16,
    padding: 24, width: '80%', gap: 16,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  input: {
    backgroundColor: '#2a2a2a', borderRadius: 8,
    padding: 12, color: '#fff', fontSize: 15,
  },
  modalBtns: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  modalCancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  modalCancelText: { color: '#888', fontSize: 15 },
  modalConfirmBtn: {
    backgroundColor: '#1DB954', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  modalConfirmText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
});
