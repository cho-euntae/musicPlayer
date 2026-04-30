import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { usePlayerStore } from '@/store/player-store';

export interface OptionItem<V> {
  value: V;
  label: string;
  hint?: string;
}

interface OptionsSheetModalProps<V> {
  visible: boolean;
  title: string;
  description?: string;
  options: OptionItem<V>[];
  selectedValue: V;
  onSelect: (value: V) => void;
  onClose: () => void;
}

// 외부 API(visible/onClose)는 종전 그대로 유지하고 내부만 @gorhom/bottom-sheet
// 기반으로 교체. 호출자 측 변경 없이 드래그-다운 / 백드롭 탭 닫기 / 부드러운
// 스프링 슬라이드 등 표준 바텀시트 UX를 그대로 얻는다.
export function OptionsSheetModal<V>({
  visible,
  title,
  description,
  options,
  selectedValue,
  onSelect,
  onClose,
}: OptionsSheetModalProps<V>) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const batterySaverEnabled = usePlayerStore((s) => s.batterySaverEnabled);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.5}
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
        {/* 시트 표면을 frosted 글래스로 처리하여 부드러운 깊이감 부여 */}
        {!batterySaverEnabled && (
          <BlurView
            intensity={55}
            tint="dark"
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
        <View style={styles.divider} />
        {options.map((option) => {
          const isSelected = option.value === selectedValue;
          return (
            <TouchableOpacity
              key={String(option.value)}
              style={styles.item}
              onPress={() => onSelect(option.value)}
            >
              <View style={styles.itemInfo}>
                <Text style={styles.itemLabel}>{option.label}</Text>
                {option.hint ? <Text style={styles.itemHint}>{option.hint}</Text> : null}
              </View>
              {isSelected ? (
                <Ionicons name="checkmark-circle" size={22} color="#1DB954" />
              ) : (
                <Ionicons name="ellipse-outline" size={22} color="#3a3a3a" />
              )}
            </TouchableOpacity>
          );
        })}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    // BlurView가 콘텐츠 위에 깔리므로 base는 반투명 다크.
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
  },
  handle: {
    backgroundColor: '#5a5a5a',
    width: 36,
  },
  content: {
    paddingBottom: 32,
  },
  header: { padding: 20, gap: 4 },
  title: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  description: { color: '#888', fontSize: 13, lineHeight: 19 },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginHorizontal: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  itemInfo: { flex: 1, gap: 2 },
  itemLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  itemHint: { color: '#888', fontSize: 12 },
});
