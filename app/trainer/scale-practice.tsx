import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  createAudioPlayer,
  useAudioRecorder,
  RecordingPresets,
  type AudioPlayer,
} from 'expo-audio';
import { usePlayerStore } from '@/store/player-store';
import { midiToNote, noteNameKoBase, vocalizeScaleUpDown } from '@/lib/trainer/notes';
import { ensureSineWavFileForMidi } from '@/lib/trainer/sine-wav';
import { useTrainerSession } from '@/hooks/use-trainer-session';
import { useTrainerMicSession } from '@/hooks/use-trainer-mic-session';

// 스케일 연습 화면.
// 진행 흐름:
//  - 사용자가 측정한 음역의 가운데 부근을 기본 키로 추천 (없으면 C4).
//  - 키를 사용자가 ± 반음으로 미세 조정 가능.
//  - "재생" 누르면 도-레-미-파-솔-파-미-레-도가 한 음씩 1초 간격으로 재생되며
//    현재 재생 중인 음이 강조 표시.
//  - "녹음하며 듣기" 토글이 켜져 있으면 9음 재생 동안 마이크로 따라 부르는 소리를
//    같이 녹음했다가 끝난 직후 자동으로 한 번 리플레이해서 비교 들을 수 있게 한다.
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
  const [isReplaying, setIsReplaying] = useState(false);
  const [recordEnabled, setRecordEnabled] = useState(false);

  // reference tone용 player와 리플레이 player는 분리해서 라이프사이클을 격리.
  const playerRef = useRef<AudioPlayer | null>(null);
  const replayPlayerRef = useRef<AudioPlayer | null>(null);
  const cancelledRef = useRef(false);
  const userTouchedRootRef = useRef(false);

  // 마이크 권한 + audio mode 전환 + cleanup은 훅이 책임짐. 단, 토글이 OFF인 동안에는
  // useAudioRecorder 인스턴스 자체는 만들어두되 record/stop 호출을 안 한다.
  // 권한 다이얼로그는 사용자가 토글을 켜는 시점에 첫 record() 호출에서 노출되는 게
  // 자연스럽다. (현재 useTrainerMicSession은 진입 시 권한을 미리 요청하지만, 사용자가
  // 보컬 트레이너에 들어왔다는 것 자체가 마이크 사용 의향의 신호라 OK.)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const { permissionGranted, cleanupRecording } = useTrainerMicSession(recorder);

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
      try {
        replayPlayerRef.current?.remove();
      } catch {
        // ignore
      }
      replayPlayerRef.current = null;
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

  // 토글 ON이면 9음 재생 시작과 함께 녹음을 시작한다.
  // 권한이 없으면 녹음 없이 진행 + 사용자 안내.
  const tryStartRecording = async (): Promise<boolean> => {
    if (!recordEnabled) return false;
    if (permissionGranted === false) {
      Alert.alert(
        '마이크 권한 필요',
        '녹음하며 듣기를 사용하려면 시스템 설정에서 마이크 권한을 허용해주세요.',
      );
      return false;
    }
    try {
      // 직전 잔존 파일이 있으면 정리.
      await cleanupRecording();
      await recorder.prepareToRecordAsync();
      recorder.record();
      return true;
    } catch (error) {
      console.warn('[scale-practice] start recording failed', error);
      return false;
    }
  };

  // 9음 끝난 직후 호출. uri를 받아 createAudioPlayer로 한 번 리플레이한다.
  const playRecordedReplay = async (): Promise<void> => {
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = (recorder as unknown as { uri?: string | null }).uri ?? null;
    } catch (error) {
      console.warn('[scale-practice] stop recording failed', error);
    }
    if (!uri || cancelledRef.current) {
      // 파일을 못 받았거나 사용자가 중간에 정지한 경우 즉시 정리.
      await cleanupRecording();
      return;
    }
    try {
      // 이전 리플레이 인스턴스 정리.
      try {
        await Promise.resolve(replayPlayerRef.current?.remove());
      } catch {
        // ignore
      }
      const replay = createAudioPlayer(uri);
      replayPlayerRef.current = replay;
      setIsReplaying(true);
      replay.play();
      // 녹음 길이 = 9음 × (700+100)ms = 7200ms. 약간의 여유를 두고 정리.
      const replayWindowMs = scale.length * (NOTE_DURATION_MS + NOTE_GAP_MS) + 600;
      setTimeout(() => {
        setIsReplaying(false);
        try {
          replayPlayerRef.current?.remove();
        } catch {
          // ignore
        }
        replayPlayerRef.current = null;
        // 리플레이 끝나면 디스크의 임시 파일도 즉시 삭제 (app.json 권한 텍스트 약속).
        void cleanupRecording();
      }, replayWindowMs);
    } catch (error) {
      console.warn('[scale-practice] replay failed', error);
      setIsReplaying(false);
      await cleanupRecording();
    }
  };

  const playScale = async () => {
    if (isPlaying) return;
    cancelledRef.current = false;
    setIsPlaying(true);

    const recordingStarted = await tryStartRecording();

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
      if (recordingStarted) {
        await playRecordedReplay();
      }
    }
  };

  const stopScale = () => {
    cancelledRef.current = true;
    try {
      playerRef.current?.pause();
    } catch {
      // ignore
    }
    try {
      replayPlayerRef.current?.pause();
    } catch {
      // ignore
    }
    setActiveIdx(null);
    setIsPlaying(false);
    setIsReplaying(false);
    // 진행 중이던 녹음/리플레이 임시 파일 즉시 정리.
    void cleanupRecording();
  };

  const adjustRoot = (delta: number) => {
    if (isPlaying || isReplaying) return;
    userTouchedRootRef.current = true;
    setRootMidi((prev) => Math.max(36, Math.min(72, prev + delta)));
  };

  const isBusy = isPlaying || isReplaying;

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
              disabled={isBusy}
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
              disabled={isBusy}
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

        <View style={styles.recordRow}>
          <View style={styles.recordLabelBox}>
            <Text style={styles.recordLabel}>녹음하며 듣기</Text>
            <Text style={styles.recordSub}>
              9음이 끝나면 본인 발성을 자동 리플레이합니다.
            </Text>
          </View>
          <Switch
            value={recordEnabled}
            onValueChange={setRecordEnabled}
            disabled={isBusy}
            trackColor={{ false: '#252529', true: '#1DB954' }}
            thumbColor="#fff"
          />
        </View>

        {recordEnabled && (
          <View style={styles.headsetBanner}>
            <Ionicons name="headset" size={14} color="#f1c40f" />
            <Text style={styles.headsetText}>
              헤드셋 사용 권장 — 외부 스피커 사용 시 기준음이 마이크로 같이 녹음돼 비교가 흐려집니다.
            </Text>
          </View>
        )}

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
          style={[
            styles.playBtn,
            { backgroundColor: isBusy ? '#e74c3c' : '#1DB954' },
          ]}
          onPress={isBusy ? stopScale : playScale}
          activeOpacity={0.85}
        >
          <Ionicons name={isBusy ? 'stop' : 'play'} size={22} color="#fff" />
          <Text style={styles.playBtnText}>
            {isReplaying ? '리플레이 중' : isPlaying ? '정지' : '재생'}
          </Text>
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
    marginBottom: 16,
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
  recordRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1d',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#252529',
    marginBottom: 8,
  },
  recordLabelBox: { flex: 1, marginRight: 12 },
  recordLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  recordSub: { color: '#888', fontSize: 11, marginTop: 2 },
  headsetBanner: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(241, 196, 15, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  headsetText: { color: '#f1c40f', fontSize: 11, flex: 1, lineHeight: 16 },
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
