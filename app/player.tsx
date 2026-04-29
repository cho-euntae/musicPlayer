import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCurrentTrack, usePlayerStore } from '@/store/player-store';
import { useAudioControl } from '@/context/audio-player-context';
import { ProgressBar } from '@/components/player/progress-bar';
import { Controls } from '@/components/player/controls';
import { OptionsSheetModal } from '@/components/options-sheet-modal';

const SLEEP_TIMER_OPTIONS = [
  { value: 0, label: '타이머 끄기' },
  { value: 15, label: '15분 후 정지' },
  { value: 30, label: '30분 후 정지' },
  { value: 45, label: '45분 후 정지' },
  { value: 60, label: '1시간 후 정지' },
  { value: 90, label: '1시간 30분 후 정지' },
];

const PLAYBACK_RATE_OPTIONS = [
  { value: 0.75, label: '0.75×', hint: '느리게' },
  { value: 1.0, label: '1×', hint: '기본 속도' },
  { value: 1.25, label: '1.25×', hint: '살짝 빠르게' },
  { value: 1.5, label: '1.5×', hint: '빠르게' },
  { value: 1.75, label: '1.75×' },
  { value: 2.0, label: '2×', hint: '매우 빠르게' },
];

function formatRemaining(ms: number): string {
  if (ms <= 0) return '';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerScreen() {
  const currentTrack = useCurrentTrack();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrev = usePlayerStore((s) => s.playPrev);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const sleepTimerEndAt = usePlayerStore((s) => s.sleepTimerEndAt);
  const setSleepTimerMinutes = usePlayerStore((s) => s.setSleepTimerMinutes);
  const { togglePlay, seekTo } = useAudioControl();

  const [sleepModalVisible, setSleepModalVisible] = useState(false);
  const [rateModalVisible, setRateModalVisible] = useState(false);

  // 타이머 남은 시간 실시간 갱신
  const [remaining, setRemaining] = useState<number>(
    sleepTimerEndAt ? Math.max(0, sleepTimerEndAt - Date.now()) : 0,
  );

  useEffect(() => {
    if (sleepTimerEndAt === null) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, sleepTimerEndAt - Date.now());
      setRemaining(left);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEndAt]);

  const repeatLabel =
    repeatMode === 'one' ? '1곡 반복' : repeatMode === 'all' ? '전체 반복' : '반복 끔';
  const repeatIcon = repeatMode === 'off' ? 'repeat-outline' : 'repeat';
  const repeatActive = repeatMode !== 'off';

  const sleepActive = sleepTimerEndAt !== null;
  const sleepLabel = sleepActive ? formatRemaining(remaining) : '타이머';

  const rateLabel = `${playbackRate}×`;
  const rateActive = playbackRate !== 1;

  if (!currentTrack) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.empty}>
          <Ionicons name="musical-notes-outline" size={64} color="#555" />
          <Text style={styles.emptyText}>재생 중인 곡이 없습니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pillBtn, repeatActive && styles.pillBtnActive]}
          onPress={toggleRepeat}
        >
          <Ionicons
            name={repeatIcon}
            size={18}
            color={repeatActive ? '#041107' : '#fff'}
          />
          <Text style={[styles.pillBtnText, repeatActive && styles.pillBtnTextActive]}>
            {repeatLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 앨범 아트 */}
      <View style={styles.artwork}>
        <Ionicons name="musical-note" size={80} color="#1DB954" />
      </View>

      {/* 트랙 정보 */}
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>{currentTrack.title}</Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {currentTrack.artist ?? '알 수 없는 아티스트'}
        </Text>
      </View>

      {/* 보조 컨트롤: 큐 / 속도 / 타이머 */}
      <View style={styles.secondaryControls}>
        <TouchableOpacity style={styles.chipBtn} onPress={() => router.push('/queue')}>
          <Ionicons name="list-outline" size={16} color="#fff" />
          <Text style={styles.chipBtnText}>큐</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chipBtn, rateActive && styles.chipBtnActive]}
          onPress={() => setRateModalVisible(true)}
        >
          <Ionicons
            name="speedometer-outline"
            size={16}
            color={rateActive ? '#041107' : '#fff'}
          />
          <Text style={[styles.chipBtnText, rateActive && styles.chipBtnTextActive]}>
            {rateLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chipBtn, sleepActive && styles.chipBtnActive]}
          onPress={() => setSleepModalVisible(true)}
        >
          <Ionicons
            name={sleepActive ? 'moon' : 'moon-outline'}
            size={16}
            color={sleepActive ? '#041107' : '#fff'}
          />
          <Text style={[styles.chipBtnText, sleepActive && styles.chipBtnTextActive]}>
            {sleepLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 진행 바 */}
      <ProgressBar position={position} duration={duration} onSeek={seekTo} />

      {/* 컨트롤 */}
      <Controls
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onPrev={playPrev}
        onNext={playNext}
      />

      <OptionsSheetModal
        visible={sleepModalVisible}
        title="슬립 타이머"
        description={
          sleepActive
            ? `현재 남은 시간 ${formatRemaining(remaining)}`
            : '선택한 시간 뒤에 재생이 자동으로 정지됩니다.'
        }
        options={SLEEP_TIMER_OPTIONS}
        selectedValue={sleepActive ? -1 : 0}
        onSelect={(minutes) => {
          setSleepTimerMinutes(minutes === 0 ? null : minutes);
          setSleepModalVisible(false);
        }}
        onClose={() => setSleepModalVisible(false)}
      />

      <OptionsSheetModal
        visible={rateModalVisible}
        title="재생 속도"
        description="곡의 진행 속도를 조절합니다. 설정은 영구 저장됩니다."
        options={PLAYBACK_RATE_OPTIONS}
        selectedValue={playbackRate}
        onSelect={(rate) => {
          setPlaybackRate(rate);
          setRateModalVisible(false);
        }}
        onClose={() => setRateModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 24,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    padding: 4,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  pillBtnActive: {
    backgroundColor: '#d7ffe2',
    borderColor: '#d7ffe2',
  },
  pillBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  pillBtnTextActive: {
    color: '#041107',
  },
  artwork: {
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  trackInfo: {
    gap: 4,
  },
  trackTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  trackArtist: {
    color: '#888',
    fontSize: 16,
  },
  secondaryControls: {
    flexDirection: 'row',
    gap: 8,
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  chipBtnActive: {
    backgroundColor: '#d7ffe2',
    borderColor: '#d7ffe2',
  },
  chipBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  chipBtnTextActive: {
    color: '#041107',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    color: '#555',
    fontSize: 16,
  },
});
