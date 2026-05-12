import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import Pitchy from 'react-native-pitchy';
import { usePlayerStore } from '@/store/player-store';
import {
  TRAINER_MAX_MIDI,
  TRAINER_MIN_MIDI,
  frequencyToMidi,
  midiToFrequency,
  midiToNote,
  octaveAgnosticCents,
} from '@/lib/trainer/notes';
import { ensureSineWavFileForMidi } from '@/lib/trainer/sine-wav';
import { useTrainerSession } from '@/hooks/use-trainer-session';
import { useTrainerMicSession } from '@/hooks/use-trainer-mic-session';

// 측정 흐름:
//  1) 가운데 기준점 C4(60)에서 시작.
//  2) react-native-pitchy로 마이크 입력의 fundamental frequency를 실시간 검출.
//  3) 기준음과 옥타브 무시 cent 차이가 ±50 이내로 1초 안정 → 자동 "낼 수 있음" 통과.
//     (남/녀 옥타브 차이로 부르는 자연스러운 케이스를 매치로 인정)
//  4) 자동 검출이 안 잡히는 경우를 위해 "낼 수 있음 / 못 냄" 수동 버튼은 fallback으로 유지.
//  5) 상한/하한 모두 확정되면 store에 저장.
//
// 음향 메모:
//  - 외부 스피커로 reference tone을 재생하면 그게 마이크에 다시 들어가 자동 통과를
//    유발할 수 있다. 화면 상단에 헤드셋 권장 안내를 두고, 톤 재생 중에는 자동 판정을
//    잠시 비활성화한다.

type Phase = 'idle' | 'measuringHigh' | 'measuringLow' | 'done';
const START_MIDI = 60; // C4
const REFERENCE_DURATION_MS = 1500;
// pitch detection이 불안정한 톤 재생 직후 200ms는 무시.
const POST_TONE_GUARD_MS = 200;
// 자동 매치 기준: ±70 cent. 50은 정밀하지만 BT 마이크 jitter에선 빈번히 깨진다.
const CENTS_TOLERANCE = 70;
// 안정 유지 요구 시간: 1초.
const STABLE_WINDOW_MS = 1000;
// pitchy 권장 최소 입력 레벨 (dB). 이보다 낮으면 native에서 -1/0 emit.
const PITCHY_MIN_VOLUME = -50;
// median filter window. 짝수보다 홀수가 median 계산이 자명해서 5로 고정.
// BT 환경에선 한두 sample이 spike로 튀기 쉬워 5개 중간값을 쓰면 흔들림이 크게 줄어든다.
const PITCH_FILTER_WINDOW = 5;

function medianHz(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export default function RangeTestScreen() {
  useTrainerSession();
  const { permissionGranted } = useTrainerMicSession();

  const setVocalRange = usePlayerStore((s) => s.setVocalRange);

  const [phase, setPhase] = useState<Phase>('idle');
  const [currentMidi, setCurrentMidi] = useState<number>(START_MIDI);
  const [highCandidate, setHighCandidate] = useState<number | null>(null);
  const [lowCandidate, setLowCandidate] = useState<number | null>(null);
  const [isPlayingTone, setIsPlayingTone] = useState(false);
  // 실시간 검출 상태 표시용. cents 차이 + voiced 여부.
  const [liveCents, setLiveCents] = useState<number | null>(null);
  const [liveNoteName, setLiveNoteName] = useState<string | null>(null);
  const [stableProgress, setStableProgress] = useState<number>(0); // 0..1

  // expo-audio의 useAudioPlayer는 source가 정해진 한 곡 전용이라 매번 다른
  // wav를 재생하는 본 화면 패턴엔 createAudioPlayer가 더 적합하다.
  const playerRef = useRef<AudioPlayer | null>(null);

  // 자동 판정 로직에서 listener는 마운트 시점에 한 번만 등록되므로,
  // 최신 phase/currentMidi/handler는 ref를 통해 본다 (stale closure 방지).
  const phaseRef = useRef<Phase>('idle');
  const currentMidiRef = useRef<number>(START_MIDI);
  const isPlayingToneRef = useRef<boolean>(false);
  const lastToneEndedAtRef = useRef<number>(0);
  const stableStartedAtRef = useRef<number>(0);
  const autoPassInFlightRef = useRef<boolean>(false);
  // 최근 N개의 raw pitch(Hz)를 보관해 median filter로 spike를 깎는다.
  // BT 환경의 jitter는 octave error나 일시적 spike 형태로 자주 들어와서,
  // 평균보다 median이 outlier에 강하다.
  const recentPitchesRef = useRef<number[]>([]);
  // listener에서 호출하는 핸들러는 useEffect의 deps 폭을 줄이려고 ref로 우회.
  const handleCanReachRef = useRef<() => Promise<void> | void>(() => undefined);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { currentMidiRef.current = currentMidi; }, [currentMidi]);
  useEffect(() => { isPlayingToneRef.current = isPlayingTone; }, [isPlayingTone]);

  useEffect(() => {
    return () => {
      // 화면 이탈 시 player release.
      try {
        playerRef.current?.remove();
      } catch {
        // 이미 정리된 경우 무시
      }
      playerRef.current = null;
    };
  }, []);

  // Pitchy 라이프사이클: 권한 받은 시점에 init+start, unmount 시 stop+listener 해제.
  useEffect(() => {
    if (permissionGranted !== true) return;

    let subscription: ReturnType<typeof Pitchy.addListener> | null = null;
    let cancelled = false;

    const setup = async () => {
      try {
        Pitchy.init({ bufferSize: 4096, minVolume: PITCHY_MIN_VOLUME, algorithm: 'ACF2+' });
        await Pitchy.start();
        if (cancelled) {
          try { await Pitchy.stop(); } catch { /* ignore */ }
          return;
        }
        subscription = Pitchy.addListener(({ pitch }) => {
          handlePitch(pitch);
        });
      } catch (error) {
        console.warn('[range-test] pitchy setup failed', error);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      if (subscription) {
        try { subscription.remove(); } catch { /* ignore */ }
      }
      void (async () => {
        try { await Pitchy.stop(); } catch { /* ignore (이미 정지된 경우) */ }
      })();
    };
    // permissionGranted가 true가 된 이후 한 번만 등록.
    // handlePitch는 ref로 안정화되어 deps 불필요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionGranted]);

  // 매 pitch 이벤트마다 호출. measuring phase 안에서만 실제 판정.
  const handlePitch = (pitchHz: number): void => {
    const now = Date.now();
    const phase = phaseRef.current;
    if (phase !== 'measuringHigh' && phase !== 'measuringLow') {
      setLiveCents(null);
      setLiveNoteName(null);
      setStableProgress(0);
      recentPitchesRef.current = [];
      return;
    }
    // 톤 재생 중이거나 직후 가드 시간 내면 자동 판정 보류 (스피커 누설 방지).
    if (isPlayingToneRef.current) {
      stableStartedAtRef.current = 0;
      setStableProgress(0);
      recentPitchesRef.current = [];
      return;
    }
    if (lastToneEndedAtRef.current > 0 && now - lastToneEndedAtRef.current < POST_TONE_GUARD_MS) {
      stableStartedAtRef.current = 0;
      setStableProgress(0);
      recentPitchesRef.current = [];
      return;
    }
    // pitchy native가 minVolume 미만이거나 검출 실패 시 0 또는 음수 값을 emit.
    if (!Number.isFinite(pitchHz) || pitchHz <= 0) {
      stableStartedAtRef.current = 0;
      setLiveCents(null);
      setLiveNoteName(null);
      setStableProgress(0);
      recentPitchesRef.current = [];
      return;
    }

    // ringbuffer에 raw 샘플 누적. window를 넘으면 가장 오래된 값부터 버린다.
    recentPitchesRef.current.push(pitchHz);
    if (recentPitchesRef.current.length > PITCH_FILTER_WINDOW) {
      recentPitchesRef.current.shift();
    }
    // 충분한 샘플이 모이기 전(첫 ~280ms)에는 판정 보류 — spike에 휘둘리지 않게.
    if (recentPitchesRef.current.length < 3) {
      return;
    }

    const filteredHz = medianHz(recentPitchesRef.current);
    const targetHz = midiToFrequency(currentMidiRef.current);
    const cents = octaveAgnosticCents(filteredHz, targetHz);
    const detectedMidi = Math.round(frequencyToMidi(filteredHz));
    const detectedNote = midiToNote(detectedMidi);
    setLiveCents(cents);
    setLiveNoteName(detectedNote.name);
    if (Math.abs(cents) > CENTS_TOLERANCE) {
      stableStartedAtRef.current = 0;
      setStableProgress(0);
      return;
    }
    // 안정 윈도우 시작 시각을 저장하고, 누적 시간이 임계 도달하면 자동 통과.
    if (stableStartedAtRef.current === 0) {
      stableStartedAtRef.current = now;
    }
    const elapsed = now - stableStartedAtRef.current;
    setStableProgress(Math.min(1, elapsed / STABLE_WINDOW_MS));
    if (elapsed >= STABLE_WINDOW_MS && !autoPassInFlightRef.current) {
      autoPassInFlightRef.current = true;
      stableStartedAtRef.current = 0;
      setStableProgress(0);
      recentPitchesRef.current = [];
      void Promise.resolve(handleCanReachRef.current())
        .finally(() => { autoPassInFlightRef.current = false; });
    }
  };

  const note = midiToNote(currentMidi);

  const playReference = async (midi: number) => {
    try {
      setIsPlayingTone(true);
      // 톤 재생이 시작될 때 stable 윈도우는 무효화한다.
      stableStartedAtRef.current = 0;
      setStableProgress(0);
      const uri = await ensureSineWavFileForMidi(midi, REFERENCE_DURATION_MS);

      // 이전 player가 있으면 정리하고 새로 만든다 — uri마다 별도 인스턴스가 안전.
      try {
        await Promise.resolve(playerRef.current?.remove());
      } catch {
        // ignore
      }
      const player = createAudioPlayer(uri);
      playerRef.current = player;
      player.play();

      // 재생 길이만큼 idle 처리. 종료 시각도 기록해 가드 윈도우에 활용.
      setTimeout(() => {
        setIsPlayingTone(false);
        lastToneEndedAtRef.current = Date.now();
      }, REFERENCE_DURATION_MS + 100);
    } catch (error) {
      console.warn('[range-test] play failed', error);
      setIsPlayingTone(false);
      Alert.alert('재생 실패', '기준음을 재생할 수 없습니다.');
    }
  };

  const handleStart = async () => {
    setPhase('measuringHigh');
    setCurrentMidi(START_MIDI);
    setHighCandidate(null);
    setLowCandidate(null);
    await playReference(START_MIDI);
  };

  // measuringLow phase에 진입할 때는 항상 highCandidate가 결정된 상태여야 한다.
  // 한 곳에서만 전환하도록 헬퍼로 묶어 invariant를 강제한다.
  const enterMeasuringLow = async (high: number): Promise<void> => {
    setHighCandidate(high);
    setPhase('measuringLow');
    setCurrentMidi(START_MIDI - 1);
    await playReference(START_MIDI - 1);
  };

  const handleCanReach = async () => {
    if (phase === 'measuringHigh') {
      // 한 반음 위로
      const next = currentMidi + 1;
      if (next > TRAINER_MAX_MIDI) {
        // 측정 한계 도달 — 그대로 high 확정
        await enterMeasuringLow(currentMidi);
        return;
      }
      setCurrentMidi(next);
      await playReference(next);
    } else if (phase === 'measuringLow') {
      // 한 반음 아래로
      const next = currentMidi - 1;
      if (next < TRAINER_MIN_MIDI) {
        if (highCandidate == null) {
          // 정상 흐름에선 닿을 수 없는 분기. 안전망으로 측정 초기화.
          console.warn('[range-test] highCandidate missing in measuringLow');
          setPhase('idle');
          return;
        }
        finalize(currentMidi, highCandidate);
        return;
      }
      setCurrentMidi(next);
      await playReference(next);
    }
  };

  const handleCannotReach = async () => {
    if (phase === 'measuringHigh') {
      // 직전 음이 높이의 한계. 시작점도 못 내면 시작점을 high로 인정.
      const high = currentMidi - 1 < START_MIDI ? START_MIDI : currentMidi - 1;
      await enterMeasuringLow(high);
    } else if (phase === 'measuringLow') {
      if (highCandidate == null) {
        // 정상 흐름에선 닿을 수 없는 분기. 안전망으로 측정 초기화.
        console.warn('[range-test] highCandidate missing in measuringLow');
        setPhase('idle');
        return;
      }
      // 직전 음이 낮음의 한계.
      const low = currentMidi + 1;
      finalize(low, highCandidate);
    }
  };

  const finalize = (low: number, high: number) => {
    setLowCandidate(low);
    setVocalRange(low, high);
    setPhase('done');
  };

  // listener는 한 번만 등록되므로, 최신 handleCanReach를 ref로 노출.
  useEffect(() => {
    handleCanReachRef.current = handleCanReach;
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>음역대 측정</Text>
        <View style={styles.backBtn} />
      </View>

      {phase === 'idle' && (
        <View style={styles.body}>
          <Text style={styles.guide}>
            기준음을 듣고 같은 음을 내면 자동으로 인식해 다음 음으로 넘어갑니다.{'\n'}
            인식이 잘 안 될 때는 아래의 &quot;낼 수 있음 / 못 냄&quot; 버튼으로 수동 진행도 가능합니다.{'\n\n'}
            중간 음(C4)에서 시작해 위로 한계까지 올라간 뒤, 다시 아래로 내려갑니다.
          </Text>
          <Text style={styles.headsetHint}>
            🎧 정확한 자동 인식을 위해 헤드셋(유선/블루투스) 사용을 권장합니다.
          </Text>
          {permissionGranted === false && (
            <Text style={styles.warn}>
              마이크 권한이 거부되어 자동 인식은 비활성화됩니다. 수동 버튼으로 진행할 수 있습니다.
            </Text>
          )}
          <PrimaryButton label="측정 시작" onPress={handleStart} />
        </View>
      )}

      {(phase === 'measuringHigh' || phase === 'measuringLow') && (
        <View style={styles.body}>
          <Text style={styles.phaseLabel}>
            {phase === 'measuringHigh' ? '상한 탐색 중' : '하한 탐색 중'}
          </Text>
          <Text style={styles.noteName}>{note.name}</Text>
          <Text style={styles.noteSub}>
            {note.nameKo} · {note.frequency.toFixed(1)} Hz
          </Text>

          <TouchableOpacity
            style={styles.replayBtn}
            onPress={() => playReference(currentMidi)}
            disabled={isPlayingTone}
          >
            <Ionicons name={isPlayingTone ? 'volume-high' : 'play'} size={20} color="#fff" />
            <Text style={styles.replayBtnText}>
              {isPlayingTone ? '재생 중...' : '다시 듣기'}
            </Text>
          </TouchableOpacity>

          {permissionGranted === true && (
            <View style={styles.detectBox}>
              <Text style={styles.detectLabel}>실시간 인식 (median 필터)</Text>
              <Text style={styles.detectValue}>
                {liveCents == null
                  ? (isPlayingTone ? '톤 재생 중' : '소리를 내주세요')
                  : `${liveNoteName ?? '?'}  ${liveCents > 0 ? '+' : ''}${liveCents.toFixed(0)} cent`}
              </Text>
              <View style={styles.progressFrame}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(stableProgress * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.detectHint}>
                {stableProgress > 0
                  ? `안정 유지 중... ${Math.round(stableProgress * 100)}%`
                  : '같은 음을 1초 동안 안정적으로 내면 자동 통과 (옥타브 무시 ±70 cent)'}
              </Text>
            </View>
          )}

          <View style={styles.judgeBox}>
            <TouchableOpacity
              style={[styles.judgeBtn, styles.canBtn]}
              onPress={handleCanReach}
              disabled={isPlayingTone}
            >
              <Ionicons name="checkmark" size={22} color="#fff" />
              <Text style={styles.judgeBtnText}>낼 수 있음</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.judgeBtn, styles.cannotBtn]}
              onPress={handleCannotReach}
              disabled={isPlayingTone}
            >
              <Ionicons name="close" size={22} color="#fff" />
              <Text style={styles.judgeBtnText}>못 냄</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {phase === 'done' && lowCandidate != null && highCandidate != null && (
        <View style={styles.body}>
          <Text style={styles.doneTitle}>측정 완료</Text>
          <View style={styles.resultBox}>
            <ResultRow label="최저" note={midiToNote(lowCandidate).name} ko={midiToNote(lowCandidate).nameKo} />
            <View style={styles.resultDivider} />
            <ResultRow label="최고" note={midiToNote(highCandidate).name} ko={midiToNote(highCandidate).nameKo} />
            <View style={styles.resultDivider} />
            <Text style={styles.resultMeta}>
              총 {highCandidate - lowCandidate + 1}반음 ({((highCandidate - lowCandidate) / 12).toFixed(1)} 옥타브)
            </Text>
          </View>

          <PrimaryButton label="다시 측정" onPress={handleStart} />
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>완료</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

interface PrimaryButtonProps { label: string; onPress: () => void }
function PrimaryButton({ label, onPress }: PrimaryButtonProps) {
  return (
    <TouchableOpacity style={styles.primaryBtn} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

interface ResultRowProps { label: string; note: string; ko: string }
function ResultRow({ label, note, ko }: ResultRowProps) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultNote}>{note}</Text>
      <Text style={styles.resultKo}>{ko}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0e0e10' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 24, alignItems: 'center' },
  guide: { color: '#aaa', fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  phaseLabel: { color: '#888', fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  noteName: { color: '#fff', fontSize: 64, fontWeight: '900', fontVariant: ['tabular-nums'] },
  noteSub: { color: '#888', fontSize: 13, marginTop: 4, marginBottom: 28 },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#252529',
    borderRadius: 999,
    marginBottom: 36,
  },
  replayBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  judgeBox: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  judgeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  canBtn: { backgroundColor: '#1DB954' },
  cannotBtn: { backgroundColor: '#444' },
  judgeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { marginTop: 14, padding: 12 },
  secondaryBtnText: { color: '#888', fontSize: 14 },
  doneTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 24 },
  resultBox: {
    alignSelf: 'stretch',
    backgroundColor: '#1a1a1d',
    borderRadius: 14,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#252529',
  },
  resultRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  resultLabel: { color: '#888', fontSize: 13 },
  resultNote: { color: '#fff', fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  resultKo: { color: '#1DB954', fontSize: 14, fontWeight: '600' },
  resultDivider: { height: 12 },
  resultMeta: { color: '#666', fontSize: 12, marginTop: 8, textAlign: 'center' },
  headsetHint: {
    color: '#1DB954',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  warn: {
    color: '#e67e22',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  detectBox: {
    alignSelf: 'stretch',
    backgroundColor: '#1a1a1d',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#252529',
    marginBottom: 16,
  },
  detectLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 6,
  },
  detectValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  progressFrame: {
    height: 6,
    backgroundColor: '#252529',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1DB954',
  },
  detectHint: {
    color: '#777',
    fontSize: 11,
    marginTop: 8,
  },
});
