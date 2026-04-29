import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

export function OptionsSheetModal<V>({
  visible,
  title,
  description,
  options,
  selectedValue,
  onSelect,
  onClose,
}: OptionsSheetModalProps<V>) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>

        <View style={styles.divider} />

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
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
        </ScrollView>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>닫기</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  header: { padding: 20, gap: 4 },
  title: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  description: { color: '#888', fontSize: 13, lineHeight: 19 },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginHorizontal: 16 },
  list: { maxHeight: 400 },
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
  cancelBtn: {
    marginHorizontal: 16, marginTop: 8,
    paddingVertical: 14, borderRadius: 10,
    backgroundColor: '#2a2a2a', alignItems: 'center',
  },
  cancelText: { color: '#fff', fontSize: 15, fontWeight: '500' },
});
