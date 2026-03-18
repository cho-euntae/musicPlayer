import {
  View, Text, TouchableOpacity, Modal,
  StyleSheet, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Track, usePlayerStore } from '@/store/player-store';

interface PlaylistPickerModalProps {
  tracks: Track[];
  visible: boolean;
  onClose: () => void;
}

export function PlaylistPickerModal({ tracks, visible, onClose }: PlaylistPickerModalProps) {
  const { playlists, addTrackToPlaylist } = usePlayerStore();

  const handleSelect = (playlistId: string, playlistName: string) => {
    let addedCount = 0;
    let skippedCount = 0;

    tracks.forEach((track) => {
      const playlist = playlists.find((p) => p.id === playlistId);
      if (playlist?.tracks.some((t) => t.id === track.id)) {
        skippedCount++;
      } else {
        addTrackToPlaylist(playlistId, track);
        addedCount++;
      }
    });

    onClose();

    const msg =
      skippedCount > 0
        ? `${addedCount}곡 추가됨 (${skippedCount}곡은 이미 있어서 건너뜀)`
        : `${addedCount}곡이 "${playlistName}"에 추가됐습니다`;

    Alert.alert('완료', msg);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>플레이리스트에 추가</Text>
          <Text style={styles.subtitle}>{tracks.length}곡 선택됨</Text>
        </View>

        <View style={styles.divider} />

        {playlists.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="list-outline" size={36} color="#333" />
            <Text style={styles.emptyText}>
              플레이리스트가 없습니다{'\n'}Playlists 탭에서 먼저 만들어주세요
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {playlists.map((playlist) => (
              <TouchableOpacity
                key={playlist.id}
                style={styles.item}
                onPress={() => handleSelect(playlist.id, playlist.name)}
              >
                <View style={styles.itemIcon}>
                  <Ionicons name="list" size={20} color="#9b59b6" />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{playlist.name}</Text>
                  <Text style={styles.itemCount}>{playlist.tracks.length}곡</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#555" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>취소</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 32,
  },
  header: { padding: 20, gap: 4 },
  title: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  subtitle: { color: '#888', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginHorizontal: 16 },
  list: { maxHeight: 300 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  itemIcon: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: '#1a1a2a',
    justifyContent: 'center', alignItems: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { color: '#fff', fontSize: 15, fontWeight: '500' },
  itemCount: { color: '#888', fontSize: 13, marginTop: 2 },
  emptyBox: {
    alignItems: 'center', padding: 32, gap: 12,
  },
  emptyText: { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  cancelBtn: {
    marginHorizontal: 16, marginTop: 8,
    paddingVertical: 14, borderRadius: 10,
    backgroundColor: '#2a2a2a', alignItems: 'center',
  },
  cancelText: { color: '#fff', fontSize: 15, fontWeight: '500' },
});
