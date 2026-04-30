import { useEffect, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCurrentTrack, usePlayerStore } from '@/store/player-store';
import { useAudioControl } from '@/context/audio-player-context';
import { ProgressBar } from '@/components/player/progress-bar';
import { Controls } from '@/components/player/controls';
import { OptionsSheetModal } from '@/components/options-sheet-modal';
import { TrackArtwork } from '@/components/track-artwork';
import { useArtworkColors } from '@/hooks/use-artwork-colors';

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

// 컨테이너 padding(24) * 2 + 좌우 여백을 고려해 화면 너비에서 빼고,
// 너무 큰 화면에서는 320px 이상으로 키우지 않도록 클램프한다.
const SCREEN_WIDTH = Dimensions.get('window').width;
const ARTWORK_SIZE = Math.min(SCREEN_WIDTH - 48, 320);

// 풀스크린 플레이어 배경: 배터리 절약 모드면 단색, 아니면 동적 팔레트 그라디언트.
// 모듈 스코프에 정의해 컴포넌트 정체성을 고정한다 (PlayerScreen 내부에 두면
// 매 렌더마다 새로운 컴포넌트 타입이 되어 자식이 unmount/remount된다).
interface PlayerBackgroundProps {
  saver: boolean;
  primary: string;
  secondary: string;
  children: React.ReactNode;
}

function PlayerBackground({
  saver,
  primary,
  secondary,
  children,
}: PlayerBackgroundProps) {
  if (saver) {
    return <View style={backgroundStyles.solid}>{children}</View>;
  }
  return (
    <LinearGradient
      colors={[primary, secondary, '#0a0a0a']}
      style={backgroundStyles.gradient}
    >
      {children}
    </LinearGradient>
  );
}

const backgroundStyles = StyleSheet.create({
  gradient: { flex: 1 },
  solid: { flex: 1, backgroundColor: '#0a0a0a' },
});

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
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const sleepTimerEndAt = usePlayerStore((s) => s.sleepTimerEndAt);
  const setSleepTimerMinutes = usePlayerStore((s) => s.setSleepTimerMinutes);
  const loopStart = usePlayerStore((s) => s.loopStart);
  const loopEnd = usePlayerStore((s) => s.loopEnd);
  const setLoopStart = usePlayerStore((s) => s.setLoopStart);
  const setLoopEnd = usePlayerStore((s) => s.setLoopEnd);
  const batterySaverEnabled = usePlayerStore((s) => s.batterySaverEnabled);
  const { togglePlay, seekTo, playPrev, skipBy } = useAudioControl();
  const palette = useArtworkColors(currentTrack?.artwork);

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

  const formatPositionShort = (ms: number) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  const aActive = loopStart !== null;
  const bActive = loopEnd !== null;
  const loopActive = aActive && bActive;
  const aLabel = aActive ? `A ${formatPositionShort(loopStart)}` : 'A';
  const bLabel = bActive ? `B ${formatPositionShort(loopEnd)}` : 'B';

  const handleA = () => {
    // A가 설정돼 있으면 구간 전체 해제, 아니면 현재 위치로 A 설정.
    if (aActive) {
      setLoopStart(null);
      return;
    }
    setLoopStart(position);
  };

  const handleB = () => {
    if (bActive) {
      setLoopEnd(null);
      return;
    }
    if (loopStart === null) {
      // A 없이 B만 누른 경우: A 먼저 잡아준다.
      setLoopStart(position);
      return;
    }
    // 너무 짧은 구간 방지 (1초 미만이면 무시).
    if (Math.abs(position - loopStart) < 1000) return;
    setLoopEnd(position);
  };

  if (!currentTrack) {
    return (
      <PlayerBackground
        saver={batterySaverEnabled}
        primary={palette.primary}
        secondary={palette.secondary}
      >
        <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.empty}>
            <Ionicons name="musical-notes-outline" size={64} color="#555" />
            <Text style={styles.emptyText}>재생 중인 곡이 없습니다</Text>
          </View>
        </SafeAreaView>
      </PlayerBackground>
    );
  }

  return (
    <PlayerBackground
      saver={batterySaverEnabled}
      primary={palette.primary}
      secondary={palette.secondary}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
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
      <View style={styles.artworkWrap}>
        <TrackArtwork
          artwork={currentTrack.artwork}
          title={currentTrack.title}
          trackId={currentTrack.id}
          size={ARTWORK_SIZE}
          borderRadius={16}
        />
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

        {/* A-B 구간 반복 */}
        <TouchableOpacity
          style={[styles.chipBtn, aActive && styles.chipBtnActive]}
          onPress={handleA}
        >
          <Ionicons
            name="flag-outline"
            size={16}
            color={aActive ? '#041107' : '#fff'}
          />
          <Text style={[styles.chipBtnText, aActive && styles.chipBtnTextActive]}>
            {aLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chipBtn, loopActive && styles.chipBtnActive]}
          onPress={handleB}
        >
          <Ionicons
            name={loopActive ? 'repeat' : 'flag'}
            size={16}
            color={loopActive ? '#041107' : '#fff'}
          />
          <Text style={[styles.chipBtnText, loopActive && styles.chipBtnTextActive]}>
            {bLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 진행 바 */}
      <ProgressBar position={position} duration={duration} onSeek={seekTo} />

      {/* ±10초 / ±30초 스킵 버튼 */}
      <View style={styles.skipRow}>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => skipBy(-30_000)}
          hitSlop={8}
        >
          <Ionicons name="play-back" size={18} color="#fff" />
          <Text style={styles.skipBtnLabel}>30</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => skipBy(-10_000)}
          hitSlop={8}
        >
          <Ionicons name="play-back-outline" size={18} color="#fff" />
          <Text style={styles.skipBtnLabel}>10</Text>
        </TouchableOpacity>
        <View style={styles.skipSpacer} />
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => skipBy(10_000)}
          hitSlop={8}
        >
          <Text style={styles.skipBtnLabel}>10</Text>
          <Ionicons name="play-forward-outline" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => skipBy(30_000)}
          hitSlop={8}
        >
          <Text style={styles.skipBtnLabel}>30</Text>
          <Ionicons name="play-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

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
        </ScrollView>
      </SafeAreaView>
    </PlayerBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    // 배경은 LinearGradient가 그리므로 투명.
    backgroundColor: 'transparent',
  },
  container: {
    // 작은 화면에서도 모든 컨트롤(셔플/이전/재생/다음/반복)이 닿도록
    // ScrollView contentContainer로 사용. 화면이 충분히 크면 콘텐츠가 정렬되고
    // 작으면 스크롤 가능.
    padding: 24,
    paddingBottom: 32,
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
  artworkWrap: {
    alignItems: 'center',
    marginVertical: 8,
  },
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  skipBtnLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  skipSpacer: {
    width: 16,
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
    flexWrap: 'wrap',
    gap: 8,
    rowGap: 8,
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
