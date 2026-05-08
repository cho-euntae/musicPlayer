import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { usePlayerStore } from '@/store/player-store';
import { midiToNote } from '@/lib/trainer/notes';
import { useTrainerSession } from '@/hooks/use-trainer-session';

interface TrainerCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
  meta?: string;
  onPress: () => void;
}

function TrainerCard({ icon, iconColor, title, description, meta, onPress }: TrainerCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.iconWrap, { backgroundColor: `${iconColor}22` }]}>
        <Ionicons name={icon} size={26} color={iconColor} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{description}</Text>
        {meta && <Text style={styles.cardMeta}>{meta}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#555" />
    </TouchableOpacity>
  );
}

export default function TrainerScreen() {
  // 트레이너 인덱스 자체에서도 음악은 정지시킨다 — 사용자가 카드를 탭한
  // 직후 다음 화면 진입까지 짧은 사이에 음악이 흐르면 어색하기 때문.
  useTrainerSession();

  const lowMidi = usePlayerStore((s) => s.vocalRangeLowMidi);
  const highMidi = usePlayerStore((s) => s.vocalRangeHighMidi);

  const rangeLabel =
    lowMidi != null && highMidi != null
      ? `${midiToNote(lowMidi).name} ~ ${midiToNote(highMidi).name}`
      : '아직 측정 안 함';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>보컬 트레이너</Text>
        <Text style={styles.headerSub}>음악 재생과 격리된 모드입니다. 진입 시 자동 일시정지.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <TrainerCard
          icon="mic"
          iconColor="#1DB954"
          title="1. 마이크 테스트"
          description="입력이 정상인지 확인합니다. 다음 단계의 전제조건."
          onPress={() => router.push('/trainer/mic-test')}
        />
        <TrainerCard
          icon="trending-up"
          iconColor="#f39c12"
          title="2. 음역대 측정"
          description="기준음을 듣고 따라 불러 본인의 최저/최고 음을 찾습니다."
          meta={`현재 저장된 음역: ${rangeLabel}`}
          onPress={() => router.push('/trainer/range-test')}
        />
        <TrainerCard
          icon="musical-notes"
          iconColor="#9b59b6"
          title="3. 스케일 연습"
          description="도-레-미-파-솔-파-미-레-도. 본인 음역에 맞는 키로 자동 이조."
          meta={
            lowMidi != null && highMidi != null
              ? '측정된 음역 기준으로 추천 키 표시'
              : '먼저 음역대 측정을 권장합니다'
          }
          onPress={() => router.push('/trainer/scale-practice')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0e0e10',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },
  headerSub: {
    color: '#777',
    fontSize: 12,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1d',
    borderRadius: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: '#252529',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cardDesc: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 2,
  },
  cardMeta: {
    color: '#1DB954',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
});
