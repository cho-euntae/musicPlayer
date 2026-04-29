import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

interface TextInputModalProps {
  visible: boolean;
  title: string;
  description?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  maxLength?: number;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

export function TextInputModal({
  visible,
  title,
  description,
  initialValue = '',
  placeholder,
  confirmLabel = '확인',
  maxLength = 80,
  onConfirm,
  onClose,
}: TextInputModalProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [visible, initialValue]);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0;

  const handleConfirm = () => {
    if (!canSubmit) return;
    onConfirm(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}

          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor="#555"
            maxLength={maxLength}
            autoFocus
            onSubmitEditing={handleConfirm}
            returnKeyType="done"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
              onPress={handleConfirm}
              disabled={!canSubmit}
            >
              <Text
                style={[styles.primaryText, !canSubmit && styles.primaryTextDisabled]}
              >
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1e1e1e',
    borderRadius: 18,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  description: {
    color: '#8a8a8a',
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    backgroundColor: '#121212',
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
  },
  secondaryText: {
    color: '#ddd',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1DB954',
  },
  primaryBtnDisabled: {
    backgroundColor: '#24402d',
  },
  primaryText: {
    color: '#041107',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryTextDisabled: {
    color: '#4b6b57',
  },
});
