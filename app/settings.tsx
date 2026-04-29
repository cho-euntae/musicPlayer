import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OptionsSheetModal, type OptionItem } from '@/components/options-sheet-modal';
import {
  RECENTLY_PLAYED_LIMIT_OPTIONS,
  type LibrarySortMode,
  type RecentlyPlayedLimit,
  type ThemeMode,
  usePlayerStore,
} from '@/store/player-store';
import { useMediaLibrary } from '@/hooks/use-media-library';

type ModalKind = 'sort' | 'limit' | 'theme';

const SORT_LABELS: Record<LibrarySortMode, string> = {
  name: '이름순',
  recent: '최신순',
  playCount: '재생 횟수순',
};

const THEME_LABELS: Record<ThemeMode, string> = {
  system: '시스템 설정 따름',
  dark: '다크',
  light: '라이트',
};

export default function SettingsScreen() {
  const hideCallRecordings = usePlayerStore((s) => s.hideCallRecordings);
  const recentlyPlayedLimit = usePlayerStore((s) => s.recentlyPlayedLimit);
  const librarySortMode = usePlayerStore((s) => s.librarySortMode);
  const themeMode = usePlayerStore((s) => s.themeMode);
  const recentlyPlayedCount = usePlayerStore((s) => s.recentlyPlayed.length);

  const setHideCallRecordings = usePlayerStore((s) => s.setHideCallRecordings);
  const setRecentlyPlayedLimit = usePlayerStore((s) => s.setRecentlyPlayedLimit);
  const setLibrarySortMode = usePlayerStore((s) => s.setLibrarySortMode);
  const setThemeMode = usePlayerStore((s) => s.setThemeMode);

  const { refresh } = useMediaLibrary();

  const [activeModal, setActiveModal] = useState<ModalKind | null>(null);

  const sortOptions: OptionItem<LibrarySortMode>[] = useMemo(
    () => [
      { value: 'name', label: SORT_LABELS.name },
      { value: 'recent', label: SORT_LABELS.recent },
      { value: 'playCount', label: SORT_LABELS.playCount },
    ],
    [],
  );

  const limitOptions: OptionItem<RecentlyPlayedLimit>[] = useMemo(
    () =>
      RECENTLY_PLAYED_LIMIT_OPTIONS.map((value) => ({
        value,
        label: `${value}곡`,
      })),
    [],
  );

  const themeOptions: OptionItem<ThemeMode>[] = useMemo(
    () => [
      { value: 'system', label: THEME_LABELS.system },
      { value: 'dark', label: THEME_LABELS.dark },
      { value: 'light', label: THEME_LABELS.light },
    ],
    [],
  );

  const handleToggleHideCallRecordings = (next: boolean) => {
    setHideCallRecordings(next);
    void refresh();
  };

  const handleSelectLimit = (limit: RecentlyPlayedLimit) => {
    setRecentlyPlayedLimit(limit);
    setActiveModal(null);
    if (recentlyPlayedCount > limit) {
      Alert.alert(
        '최근 재생 항목 정리',
        `이전 한도(${recentlyPlayedCount}곡) 중 ${recentlyPlayedCount - limit}곡이 새 한도(${limit}곡)에 맞춰 잘렸습니다.`,
      );
    }
  };

  const handleSelectSort = (mode: LibrarySortMode) => {
    setLibrarySortMode(mode);
    setActiveModal(null);
  };

  const handleSelectTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    setActiveModal(null);
    if (mode !== 'dark') {
      Alert.alert(
        '테마 적용 예정',
        '현재 빌드에서는 다크 테마만 시각적으로 반영됩니다. 선택한 값은 저장되며, 추후 라이트 테마 작업이 끝나면 자동으로 적용됩니다.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>설정</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 라이브러리 */}
        <Text style={styles.sectionTitle}>라이브러리</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>통화녹음 숨기기</Text>
              <Text style={styles.rowDesc}>
                갤럭시 통화녹음 폴더(Recordings/Call 등) 파일을 라이브러리에서 제외
              </Text>
            </View>
            <Switch
              value={hideCallRecordings}
              onValueChange={handleToggleHideCallRecordings}
              thumbColor={hideCallRecordings ? '#1DB954' : '#888'}
              trackColor={{ false: '#2a2a2a', true: '#1f4730' }}
            />
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={() => setActiveModal('sort')}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>기본 정렬 방식</Text>
              <Text style={styles.rowDesc}>라이브러리에 진입할 때의 정렬 순서</Text>
            </View>
            <View style={styles.rowValueWrap}>
              <Text style={styles.rowValue}>{SORT_LABELS[librarySortMode]}</Text>
              <Ionicons name="chevron-forward" size={18} color="#555" />
            </View>
          </TouchableOpacity>
        </View>

        {/* 최근 재생 */}
        <Text style={styles.sectionTitle}>최근 재생</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => setActiveModal('limit')}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>저장 개수</Text>
              <Text style={styles.rowDesc}>
                현재 {recentlyPlayedCount}곡 보관 중 / 최대 {recentlyPlayedLimit}곡
              </Text>
            </View>
            <View style={styles.rowValueWrap}>
              <Text style={styles.rowValue}>{recentlyPlayedLimit}곡</Text>
              <Ionicons name="chevron-forward" size={18} color="#555" />
            </View>
          </TouchableOpacity>
        </View>

        {/* 테마 */}
        <Text style={styles.sectionTitle}>테마</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => setActiveModal('theme')}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>화면 테마</Text>
              <Text style={styles.rowDesc}>현재 다크 테마만 적용됩니다 (라이트 테마는 추후)</Text>
            </View>
            <View style={styles.rowValueWrap}>
              <Text style={styles.rowValue}>{THEME_LABELS[themeMode]}</Text>
              <Ionicons name="chevron-forward" size={18} color="#555" />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.footnote}>설정은 자동 저장됩니다.</Text>
      </ScrollView>

      <OptionsSheetModal
        visible={activeModal === 'sort'}
        title="기본 정렬 방식"
        options={sortOptions}
        selectedValue={librarySortMode}
        onSelect={handleSelectSort}
        onClose={() => setActiveModal(null)}
      />

      <OptionsSheetModal
        visible={activeModal === 'limit'}
        title="최근 재생 저장 개수"
        options={limitOptions}
        selectedValue={recentlyPlayedLimit}
        onSelect={handleSelectLimit}
        onClose={() => setActiveModal(null)}
      />

      <OptionsSheetModal
        visible={activeModal === 'theme'}
        title="화면 테마"
        options={themeOptions}
        selectedValue={themeMode}
        onSelect={handleSelectTheme}
        onClose={() => setActiveModal(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1110',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 32,
    alignItems: 'center',
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  sectionTitle: {
    color: '#5d8f6d',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#171a18',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#232825',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  rowDesc: {
    color: '#7a857f',
    fontSize: 12,
    lineHeight: 17,
  },
  rowValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowValue: {
    color: '#cfd6d2',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#222724',
    marginHorizontal: 16,
  },
  footnote: {
    color: '#5b6661',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
