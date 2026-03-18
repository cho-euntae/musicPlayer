import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Track, usePlayerStore } from '@/store/player-store';
import { TrackOptionsModal } from '@/components/track-options-modal';

interface TrackItemProps {
  track: Track;
  isActive?: boolean;
  isSelected?: boolean;
  isSelectMode?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function TrackItem({
  track, isActive, isSelected, isSelectMode, onPress, onLongPress,
}: TrackItemProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const favorited = usePlayerStore((s) => s.favorites.includes(track.id));

  return (
    <>
      <TouchableOpacity
        style={[styles.container, isSelected && styles.containerSelected]}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
        delayLongPress={300}
      >
        {/* 선택 모드: 체크박스 / 일반 모드: 앨범 아트 */}
        {isSelectMode ? (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Ionicons name="checkmark" size={16} color="#000" />}
          </View>
        ) : (
          <View style={[styles.artwork, isActive && styles.artworkActive]}>
            <Ionicons name="musical-note" size={20} color={isActive ? '#1DB954' : '#888'} />
          </View>
        )}

        <View style={styles.info}>
          <Text style={[styles.title, isActive && !isSelectMode && styles.titleActive]} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {track.artist ?? '알 수 없는 아티스트'}
          </Text>
        </View>

        <Text style={styles.duration}>{formatDuration(track.duration)}</Text>

        {!isSelectMode && (
          <>
            {favorited && <Ionicons name="heart" size={14} color="#e74c3c" />}
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); setModalVisible(true); }}
              hitSlop={8}
              style={styles.moreBtn}
            >
              <Ionicons name="ellipsis-vertical" size={18} color="#555" />
            </TouchableOpacity>
          </>
        )}
      </TouchableOpacity>

      <TrackOptionsModal
        track={track}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  containerSelected: {
    backgroundColor: '#1a2a1a',
  },
  artwork: {
    width: 44, height: 44, borderRadius: 6,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center', alignItems: 'center',
  },
  artworkActive: { backgroundColor: '#1a3a2a' },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#555',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#1DB954', borderColor: '#1DB954',
  },
  info: { flex: 1, gap: 2 },
  title: { color: '#fff', fontSize: 15, fontWeight: '500' },
  titleActive: { color: '#1DB954' },
  artist: { color: '#888', fontSize: 13 },
  duration: { color: '#666', fontSize: 13 },
  moreBtn: { padding: 4 },
});
