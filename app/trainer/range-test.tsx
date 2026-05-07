import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { usePlayerStore } from '@/store/player-store';
import { TRAINER_MAX_MIDI, TRAINER_MIN_MIDI, midiToNote } from '@/lib/trainer/notes';
import { ensureSineWavFile } from '@/lib/trainer/sine-wav';
import { useTrainerSession } from '@/hooks/use-trainer-session';

// 측정 흐름:
//  1) 가운데 기준점 C4(60)에서 시작.
//  2) 사용자가 "낼 수 있음" 응답 → 한 반음씩 위로 올리며 한계 탐색 (high)
//  3) high 확정되면 다시 가운데에서 한 반음씩 아래로 내리며 low 탐색
//  4) 둘 다 확정되면 store에 저장.
//
// 실제 pitch 분석 없이도 동작하는 단계적 자가확인 방식이라 마이크가 없어도
// 사용 가능. 향후 pitch 인식 모듈이 붙으면 객관 측정으로 교체할 수 있다.

type Phase = 'idle' | 'measuringHigh' | 'measuringLow' | 'done';
const START_MIDI = 60; // C4
const REFERENCE_DURATION_MS = 1500;

export default function RangeTestScreen() {
  useTrainerSession();

  const setVocalRange = usePlayerStore((s) => s.setVocalRange);

  const [phase, setPhase] = useState<Phase>('idle');
  const [currentMidi, setCurrentMidi] = useState<number>(START_MIDI);
  const [highCandidate, setHighCandidate] = useState<number | null>(null);
  const [lowCandidate, setLowCandidate] = useState<number | null>(null);
  const [isPlayingTone, setIsPlayingTone] = useState(false);

  // expo-audio의 useAudioPlayer는 source가 정해진 한 곡 전용이라 매번 다른
  // wav를 재생하는 본 화면 패턴엔 createAudioPlayer가 더 적합하다.
  const playerRef = useRef<AudioPlayer | null>(null);

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

  const note = midiToNote(currentMidi);

  const playReference = async (midi: number) => {
    try {
      setIsPlayingTone(true);
      const freq = midiToNote(midi).frequency;
      const uri = await ensureSineWavFile(freq, REFERENCE_DURATION_MS);

      // 이전 player가 있으면 정리하고 새로 만든다 — uri마다 별도 인스턴스가 안전.
      try {
        playerRef.current?.remove();
      } catch {
        // ignore
      }
      const player = createAudioPlayer(uri);
      playerRef.current = player;
      player.play();

      // 재생 길이만큼 idle 처리.
      setTimeout(() => setIsPlayingTone(false), REFERENCE_DURATION_MS + 100);
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

  const handleCanReach = async () => {
    if (phase === 'measuringHigh') {
      // 한 반음 위로
      const next = currentMidi + 1;
      if (next > TRAINER_MAX_MIDI) {
        // 측정 한계 도달 — 그대로 high 확정
        setHighCandidate(currentMidi);
        setPhase('measuringLow');
        setCurrentMidi(START_MIDI - 1);
        await playReference(START_MIDI - 1);
        return;
      }
      setCurrentMidi(next);
      await playReference(next);
    } else if (phase === 'measuringLow') {
      // 한 반음 아래로
      const next = currentMidi - 1;
      if (next < TRAINER_MIN_MIDI) {
        finalize(currentMidi, highCandidate ?? START_MIDI);
        return;
      }
      setCurrentMidi(next);
      await playReference(next);
    }
  };

  const handleCannotReach = async () => {
    if (phase === 'measuringHigh') {
      // 직전 음이 높이의 한계.
      const high = currentMidi - 1;
      if (high < START_MIDI) {
        // 시작점도 못 내면 시작점을 일단 high로 인정
        setHighCandidate(START_MIDI);
      } else {
        setHighCandidate(high);
      }
      setPhase('measuringLow');
      setCurrentMidi(START_MIDI - 1);
      await playReference(START_MIDI - 1);
    } else if (phase === 'measuringLow') {
      // 직전 음이 낮음의 한계.
      const low = currentMidi + 1;
      finalize(low, highCandidate ?? START_MIDI);
    }
  };

  const finalize = (low: number, high: number) => {
    setLowCandidate(low);
    setVocalRange(low, high);
    setPhase('done');
  };

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
            기준음을 한 음씩 들려드립니다. 그 음을 편하게 따라 부를 수 있는지
            &quot;낼 수 있음 / 못 냄&quot;으로 응답해주시면 됩니다.{'\n\n'}
            중간 음(C4)에서 시작해 위로 한계까지 올라간 뒤, 다시 아래로 내려갑니다.
          </Text>
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
});
