import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { usePlayerStore } from '@/store/player-store';
import { midiToNote, noteNameKoBase, vocalizeScaleUpDown } from '@/lib/trainer/notes';
import { ensureSineWavFileForMidi } from '@/lib/trainer/sine-wav';
import { useTrainerSession } from '@/hooks/use-trainer-session';

// 스케일 연습 화면.
// 진행 흐름:
//  - 사용자가 측정한 음역의 가운데 부근을 기본 키로 추천 (없으면 C4).
//  - 키를 사용자가 ± 반음으로 미세 조정 가능.
//  - "재생" 누르면 도-레-미-파-솔-파-미-레-도가 한 음씩 1초 간격으로 재생되며
//    현재 재생 중인 음이 강조 표시.
//  - 사용자는 들으며 따라 부른다. (실시간 음정 매칭은 추후 패치에서 추가)

const NOTE_DURATION_MS = 700;
const NOTE_GAP_MS = 100;

export default function ScalePracticeScreen() {
  useTrainerSession();

  const lowMidi = usePlayerStore((s) => s.vocalRangeLowMidi);
  const highMidi = usePlayerStore((s) => s.vocalRangeHighMidi);

  // 추천 시작 키: 음역대 중앙. 없으면 C4(60).
  const suggestedRoot = useMemo(() => {
    if (lowMidi != null && highMidi != null) {
      // 한 옥타브 위까지 부르므로 (root..root+12), 너무 위로 잡히지 않게 약간 보수적.
      return Math.max(lowMidi, Math.min(highMidi - 7, Math.round((lowMidi + highMidi) / 2) - 4));
    }
    return 60;
  }, [lowMidi, highMidi]);

  // suggestedRoot가 처음으로 유효하게 바뀐 시점에만 rootMidi에 반영한다.
  // (사용자가 ±버튼으로 수동 조정한 값을 store 변경이 덮어쓰지 않도록 가드.)
  const [rootMidi, setRootMidi] = useState<number>(suggestedRoot);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playerRef = useRef<AudioPlayer | null>(null);
  const cancelledRef = useRef(false);
  const userTouchedRootRef = useRef(false);

  useEffect(() => {
    if (userTouchedRootRef.current) return;
    setRootMidi(suggestedRoot);
  }, [suggestedRoot]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      try {
        playerRef.current?.remove();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, []);

  const scale = useMemo(() => vocalizeScaleUpDown(rootMidi), [rootMidi]);
  const rootNote = midiToNote(rootMidi);
  const topNote = scale[Math.floor(scale.length / 2)]; // 최고음 (5번째 음, 솔)

  const isOutOfRange =
    lowMidi != null && highMidi != null && (rootMidi < lowMidi || topNote.midi > highMidi);

  // 9음을 한 인스턴스로 재사용하기 위해, 음마다 새 player를 만드는 대신
  // replace(uri)로 source만 바꿔 끼운다. expo-audio의 AudioPlayer가 replace를
  // 노출하지 않는 버전이 있을 수 있어 안전하게 fallback으로 await remove()도 둔다.
  const swapPlayerSource = async (uri: string): Promise<AudioPlayer> => {
    const existing = playerRef.current;
    if (existing) {
      // expo-audio AudioPlayer.replace는 SDK에 따라 메서드명이 다를 수 있어 동적 호출.
      const replace = (existing as unknown as { replace?: (src: string) => void }).replace;
      if (typeof replace === 'function') {
        try {
          replace.call(existing, uri);
          return existing;
        } catch {
          // 실패 시 아래 재생성 경로로 fall through.
        }
      }
      try {
        await Promise.resolve(existing.remove());
      } catch {
        // ignore
      }
      playerRef.current = null;
    }
    const player = createAudioPlayer(uri);
    playerRef.current = player;
    return player;
  };

  const playOne = async (midi: number): Promise<void> => {
    const uri = await ensureSineWavFileForMidi(midi, NOTE_DURATION_MS);
    if (cancelledRef.current) return;
    const player = await swapPlayerSource(uri);
    if (cancelledRef.current) return;
    player.play();
  };

  const playScale = async () => {
    if (isPlaying) return;
    cancelledRef.current = false;
    setIsPlaying(true);
    try {
      for (let i = 0; i < scale.length; i++) {
        if (cancelledRef.current) break;
        setActiveIdx(i);
        await playOne(scale[i].midi);
        if (cancelledRef.current) break;
        await new Promise((resolve) => setTimeout(resolve, NOTE_DURATION_MS + NOTE_GAP_MS));
      }
    } catch (error) {
      console.warn('[scale-practice] play failed', error);
      Alert.alert('재생 실패', '기준음을 재생할 수 없습니다.');
    } finally {
      setActiveIdx(null);
      setIsPlaying(false);
    }
  };

  const stopScale = () => {
    cancelledRef.current = true;
    try {
      playerRef.current?.pause();
    } catch {
      // ignore
    }
    setActiveIdx(null);
    setIsPlaying(false);
  };

  const adjustRoot = (delta: number) => {
    if (isPlaying) return;
    userTouchedRootRef.current = true;
    setRootMidi((prev) => Math.max(36, Math.min(72, prev + delta)));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>스케일 연습</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.keyBox}>
          <Text style={styles.keyLabel}>시작 키</Text>
          <View style={styles.keyControl}>
            <TouchableOpacity
              style={styles.keyAdjustBtn}
              onPress={() => adjustRoot(-1)}
              disabled={isPlaying}
            >
              <Ionicons name="remove" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.keyDisplay}>
              <Text style={styles.keyNote}>{rootNote.name}</Text>
              <Text style={styles.keyKo}>{rootNote.nameKo}</Text>
            </View>
            <TouchableOpacity
              style={styles.keyAdjustBtn}
              onPress={() => adjustRoot(1)}
              disabled={isPlaying}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {lowMidi != null && highMidi != null && (
            <Text style={styles.keyHint}>
              음역대 {midiToNote(lowMidi).name} ~ {midiToNote(highMidi).name}
              {isOutOfRange ? ' · 일부 음이 범위 밖' : ' · 추천 키 내'}
            </Text>
          )}
        </View>

        <View style={styles.scaleRow}>
          {scale.map((n, idx) => (
            <View
              key={`${idx}-${n.midi}`}
              style={[
                styles.scaleNoteBox,
                activeIdx === idx && styles.scaleNoteActive,
              ]}
            >
              <Text
                style={[
                  styles.scaleNoteText,
                  activeIdx === idx && styles.scaleNoteTextActive,
                ]}
              >
                {noteNameKoBase(n)}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.scaleHint}>도-레-미-파-솔-파-미-레-도</Text>

        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: isPlaying ? '#e74c3c' : '#1DB954' }]}
          onPress={isPlaying ? stopScale : playScale}
          activeOpacity={0.85}
        >
          <Ionicons name={isPlaying ? 'stop' : 'play'} size={22} color="#fff" />
          <Text style={styles.playBtnText}>{isPlaying ? '정지' : '재생'}</Text>
        </TouchableOpacity>

        <Text style={styles.tip}>
          기준음을 들으며 같이 따라 불러보세요. 한 키가 부담스러우면 ±버튼으로
          반음씩 조정할 수 있습니다.
        </Text>
      </ScrollView>
    </SafeAreaView>
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
  body: { paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center' },
  keyBox: {
    alignSelf: 'stretch',
    backgroundColor: '#1a1a1d',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#252529',
    alignItems: 'center',
    marginBottom: 24,
  },
  keyLabel: { color: '#888', fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  keyControl: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  keyAdjustBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#252529',
    alignItems: 'center', justifyContent: 'center',
  },
  keyDisplay: { alignItems: 'center', minWidth: 80 },
  keyNote: { color: '#fff', fontSize: 32, fontWeight: '900', fontVariant: ['tabular-nums'] },
  keyKo: { color: '#1DB954', fontSize: 12, fontWeight: '600', marginTop: 2 },
  keyHint: { color: '#666', fontSize: 11, marginTop: 10 },
  scaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  scaleNoteBox: {
    width: 44, height: 52, borderRadius: 10,
    backgroundColor: '#1a1a1d',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#252529',
  },
  scaleNoteActive: { backgroundColor: '#1DB954', borderColor: '#1DB954' },
  scaleNoteText: { color: '#aaa', fontSize: 14, fontWeight: '700' },
  scaleNoteTextActive: { color: '#041107' },
  scaleHint: { color: '#666', fontSize: 11, marginTop: 4, marginBottom: 24 },
  playBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 36, paddingVertical: 14, borderRadius: 999,
  },
  playBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tip: { color: '#777', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 20, paddingHorizontal: 8 },
});
