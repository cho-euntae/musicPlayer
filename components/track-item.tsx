import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Track } from '@/store/player-store';

interface TrackItemProps {
  track: Track;
  isActive?: boolean;
  onPress: () => void;
}

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function TrackItem({ track, isActive, onPress }: TrackItemProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.artwork, isActive && styles.artworkActive]}>
        <Ionicons name="musical-note" size={20} color={isActive ? '#1DB954' : '#888'} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, isActive && styles.titleActive]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist ?? '알 수 없는 아티스트'}
        </Text>
      </View>
      <Text style={styles.duration}>{formatDuration(track.duration)}</Text>
    </TouchableOpacity>
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
  artwork: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  artworkActive: {
    backgroundColor: '#1a3a2a',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  titleActive: {
    color: '#1DB954',
  },
  artist: {
    color: '#888',
    fontSize: 13,
  },
  duration: {
    color: '#666',
    fontSize: 13,
  },
});
