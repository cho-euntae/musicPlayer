import { View, Text, StyleSheet, PanResponder } from 'react-native';
import { useRef } from 'react';

interface ProgressBarProps {
  position: number;   // ms
  duration: number;   // ms
  onSeek: (positionMs: number) => void;
}

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function ProgressBar({ position, duration, onSeek }: ProgressBarProps) {
  const barRef = useRef<View>(null);
  const barWidthRef = useRef(0);

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const x = e.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(x / barWidthRef.current, 1));
      onSeek(ratio * duration);
    },
    onPanResponderMove: (e) => {
      const x = e.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(x / barWidthRef.current, 1));
      onSeek(ratio * duration);
    },
  });

  return (
    <View style={styles.container}>
      <View
        ref={barRef}
        style={styles.bar}
        onLayout={(e) => { barWidthRef.current = e.nativeEvent.layout.width; }}
        {...panResponder.panHandlers}
      >
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.time}>{formatTime(position)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  bar: {
    height: 4,
    backgroundColor: '#3a3a3a',
    borderRadius: 2,
    justifyContent: 'center',
  },
  fill: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    marginLeft: -7,
    top: -5,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    color: '#888',
    fontSize: 12,
  },
});
