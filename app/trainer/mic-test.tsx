import { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { useTrainerSession } from '@/hooks/use-trainer-session';

// metering 값(dBFS)을 0..1 범위로 정규화. -60dB을 무음에 가까운 바닥,
// -10dB을 강한 입력으로 본다.
function normalizeMeter(meteringDb: number | undefined): number {
  if (meteringDb == null || !Number.isFinite(meteringDb)) return 0;
  const min = -60;
  const max = -10;
  const clamped = Math.max(min, Math.min(max, meteringDb));
  return (clamped - min) / (max - min);
}

export default function MicTestScreen() {
  useTrainerSession();

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  // 50ms 간격으로 metering 폴링 — 시각적 부드러움과 부담의 절충.
  const recorderState = useAudioRecorderState(recorder, 50);

  useEffect(() => {
    void (async () => {
      try {
        const { granted } = await requestRecordingPermissionsAsync();
        setPermissionGranted(granted);
        if (granted) {
          // iOS에서 마이크 입력을 허용하려면 카테고리를 playAndRecord로 전환해야 함.
          // Android는 무시되지만 호출해도 안전.
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        }
      } catch (error) {
        console.warn('[mic-test] permission/audio mode error', error);
        setPermissionGranted(false);
      }
    })();

    return () => {
      // 화면을 벗어날 때는 녹음 세션을 깔끔히 종료. 자동 재개는 안 함.
      void (async () => {
        try {
          if (recorder.isRecording) await recorder.stop();
          await setAudioModeAsync({ allowsRecording: false });
        } catch {
          // 이미 정지/해제된 경우 무시
        }
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = async () => {
    if (!permissionGranted) {
      Alert.alert('마이크 권한 필요', '시스템 설정에서 마이크 권한을 허용해주세요.');
      return;
    }
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      console.warn('[mic-test] start failed', error);
    }
  };

  const handleStop = async () => {
    try {
      await recorder.stop();
    } catch (error) {
      console.warn('[mic-test] stop failed', error);
    }
  };

  const meterLevel = normalizeMeter(recorderState.metering);
  const meterColor = useMemo(() => {
    if (meterLevel < 0.15) return '#444';   // 너무 작음
    if (meterLevel > 0.9) return '#e74c3c'; // 클리핑 위험
    return '#1DB954';
  }, [meterLevel]);

  const isRecording = recorderState.isRecording;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>마이크 테스트</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.body}>
        <Text style={styles.guide}>
          {isRecording
            ? '마이크에 대고 평소 노래하는 정도의 음량으로 발성해보세요.'
            : '아래 버튼을 눌러 녹음을 시작하면 입력 레벨이 표시됩니다.'}
        </Text>

        <View style={styles.meterFrame}>
          <View
            style={[
              styles.meterFill,
              { width: `${Math.max(2, meterLevel * 100)}%`, backgroundColor: meterColor },
            ]}
          />
        </View>
        <Text style={styles.meterLabel}>
          {recorderState.metering != null
            ? `입력 레벨: ${Math.round(recorderState.metering)} dBFS`
            : '입력 레벨: --'}
        </Text>

        <View style={styles.hintBox}>
          <Hint
            ok={meterLevel > 0.15}
            okText="입력 감지됨"
            ngText="입력이 너무 작거나 없음"
          />
          <Hint
            ok={meterLevel < 0.9}
            okText="클리핑 없음"
            ngText="너무 큼 — 마이크에서 떨어지세요"
            invertWhenIdle
          />
        </View>

        <TouchableOpacity
          style={[styles.recordBtn, { backgroundColor: isRecording ? '#e74c3c' : '#1DB954' }]}
          onPress={isRecording ? handleStop : handleStart}
          activeOpacity={0.85}
        >
          <Ionicons
            name={isRecording ? 'stop-circle' : 'mic'}
            size={28}
            color="#fff"
          />
          <Text style={styles.recordBtnText}>
            {isRecording ? '정지' : '녹음 시작'}
          </Text>
        </TouchableOpacity>

        {permissionGranted === false && (
          <Text style={styles.warn}>
            마이크 권한이 거부되었습니다. 시스템 설정에서 허용 후 다시 진입해주세요.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

interface HintProps {
  ok: boolean;
  okText: string;
  ngText: string;
  invertWhenIdle?: boolean;
}

function Hint({ ok, okText, ngText, invertWhenIdle }: HintProps) {
  // 녹음 시작 전에는 NG 메시지가 도배되지 않도록 회색 처리.
  const isIdle = !ok && !invertWhenIdle;
  return (
    <View style={styles.hintRow}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={ok ? '#1DB954' : isIdle ? '#555' : '#e67e22'}
      />
      <Text style={[styles.hintText, { color: ok ? '#1DB954' : isIdle ? '#555' : '#e67e22' }]}>
        {ok ? okText : ngText}
      </Text>
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
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 12 },
  guide: { color: '#aaa', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  meterFrame: {
    height: 16,
    backgroundColor: '#1a1a1d',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#252529',
  },
  meterFill: { height: '100%' },
  meterLabel: { color: '#888', fontSize: 12, marginTop: 8, fontVariant: ['tabular-nums'] },
  hintBox: { marginTop: 24, gap: 8 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hintText: { fontSize: 13 },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 999,
    marginTop: 32,
  },
  recordBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  warn: { color: '#e67e22', fontSize: 12, marginTop: 16, textAlign: 'center' },
});
