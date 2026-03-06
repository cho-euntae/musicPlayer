import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function PlaylistsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Playlists</Text>
        <TouchableOpacity style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#1DB954" />
        </TouchableOpacity>
      </View>

      <View style={styles.emptyBox}>
        <Ionicons name="list-outline" size={64} color="#333" />
        <Text style={styles.emptyTitle}>플레이리스트가 없습니다</Text>
        <Text style={styles.emptyDesc}>
          + 버튼을 눌러 새 플레이리스트를 만들어보세요.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#555',
    fontSize: 17,
    fontWeight: '600',
  },
  emptyDesc: {
    color: '#444',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
