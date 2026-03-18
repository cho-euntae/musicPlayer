import {
  View, Text, TouchableOpacity, Modal,
  StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Track, usePlayerStore } from '@/store/player-store';

interface TrackOptionsModalProps {
  track: Track | null;
  visible: boolean;
  onClose: () => void;
}

export function TrackOptionsModal({ track, visible, onClose }: TrackOptionsModalProps) {
  const { playlists, addTrackToPlaylist, toggleFavorite, favorites } = usePlayerStore();
  const isFav = track ? favorites.includes(track.id) : false;

  if (!track) return null;

  const handleAddToPlaylist = (playlistId: string) => {
    addTrackToPlaylist(playlistId, track);
    onClose();
  };

  const handleToggleFavorite = () => {
    toggleFavorite(track.id);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        {/* 트랙 정보 */}
        <View style={styles.trackInfo}>
          <View style={styles.trackIcon}>
            <Ionicons name="musical-note" size={20} color="#1DB954" />
          </View>
          <View style={styles.trackTexts}>
            <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {track.artist ?? '알 수 없는 아티스트'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* 즐겨찾기 */}
        <TouchableOpacity style={styles.option} onPress={handleToggleFavorite}>
          <Ionicons
            name={isFav ? 'heart' : 'heart-outline'}
            size={20}
            color={isFav ? '#e74c3c' : '#fff'}
          />
          <Text style={styles.optionText}>
            {isFav ? '즐겨찾기 제거' : '즐겨찾기 추가'}
          </Text>
        </TouchableOpacity>

        {/* 플레이리스트에 추가 */}
        {playlists.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>플레이리스트에 추가</Text>
            <ScrollView style={styles.playlistList} showsVerticalScrollIndicator={false}>
              {playlists.map((playlist) => {
                const alreadyAdded = playlist.tracks.some((t) => t.id === track.id);
                return (
                  <TouchableOpacity
                    key={playlist.id}
                    style={styles.option}
                    onPress={() => !alreadyAdded && handleAddToPlaylist(playlist.id)}
                    disabled={alreadyAdded}
                  >
                    <Ionicons
                      name={alreadyAdded ? 'checkmark-circle' : 'add-circle-outline'}
                      size={20}
                      color={alreadyAdded ? '#1DB954' : '#fff'}
                    />
                    <Text style={[styles.optionText, alreadyAdded && styles.optionAdded]}>
                      {playlist.name}
                      {alreadyAdded ? '  ✓ 추가됨' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {playlists.length === 0 && (
          <Text style={styles.noPlaylist}>
            Playlists 탭에서 플레이리스트를 먼저 만들어주세요
          </Text>
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>닫기</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: '60%',
  },
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  trackIcon: {
    width: 40, height: 40, borderRadius: 6,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center', alignItems: 'center',
  },
  trackTexts: { flex: 1 },
  trackTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  trackArtist: { color: '#888', fontSize: 13, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginHorizontal: 16 },
  sectionLabel: {
    color: '#888', fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
  },
  playlistList: { maxHeight: 200 },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  optionText: { color: '#fff', fontSize: 15 },
  optionAdded: { color: '#1DB954' },
  noPlaylist: {
    color: '#555', fontSize: 13, textAlign: 'center',
    padding: 20,
  },
  cancelBtn: {
    marginHorizontal: 16, marginTop: 8,
    paddingVertical: 14, borderRadius: 10,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
  },
  cancelText: { color: '#fff', fontSize: 15, fontWeight: '500' },
});
