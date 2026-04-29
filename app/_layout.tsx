import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AudioPlayerProvider } from '@/context/audio-player-context';
import { usePlayerStore } from '@/store/player-store';
import { useMediaLibrary } from '@/hooks/use-media-library';
// playback service 등록은 진입점(index.js)에서 처리한다.
// 헤드리스 알림 액션 시 이 컴포넌트는 마운트되지 않기 때문이다.

function AppInitializer() {
  useMediaLibrary();
  const lastQueue = usePlayerStore((s) => s.lastQueue);
  const lastTrackIndex = usePlayerStore((s) => s.lastTrackIndex);
  const lastPosition = usePlayerStore((s) => s.lastPosition);
  const restoreQueue = usePlayerStore((s) => s.restoreQueue);
  const hasRestoredRef = useRef(false);

  // 앱 시작 시 마지막 재생 큐/곡 복원 (1회)
  useEffect(() => {
    if (hasRestoredRef.current) return;
    if (lastQueue.length === 0) return;
    hasRestoredRef.current = true;
    restoreQueue(lastQueue, lastTrackIndex, lastPosition);
  }, [lastPosition, lastQueue, lastTrackIndex, restoreQueue]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AudioPlayerProvider>
        <AppInitializer />
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="player"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen name="queue" />
          <Stack.Screen name="playlist/[id]" />
        </Stack>
      </AudioPlayerProvider>
    </GestureHandlerRootView>
  );
}
