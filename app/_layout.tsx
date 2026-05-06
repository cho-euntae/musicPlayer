import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AudioPlayerProvider } from '@/context/audio-player-context';
import { usePlayerStore } from '@/store/player-store';
import { useMediaLibrary } from '@/hooks/use-media-library';
import { useTheme } from '@/hooks/use-theme';
// playback service 등록은 진입점(index.js)에서 처리한다.
// 헤드리스 알림 액션 시 이 컴포넌트는 마운트되지 않기 때문이다.

// 테마(다크/라이트/시스템)에 맞춰 상태바 색상을 자동 전환한다.
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />;
}

function AppInitializer() {
  useMediaLibrary();
  const lastQueue = usePlayerStore((s) => s.lastQueue);
  const lastTrackIndex = usePlayerStore((s) => s.lastTrackIndex);
  const lastPosition = usePlayerStore((s) => s.lastPosition);
  const restoreQueue = usePlayerStore((s) => s.restoreQueue);
  const hasRestoredRef = useRef(false);

  // 앱 시작 시 마지막 재생 큐/곡 복원 (1회).
  // "새 설치"인 경우엔 lastQueue가 비어있어야 하는데, Android 자동 백업이
  // 켜져 있으면 uninstall→reinstall 후에도 데이터가 복원되어 마치 세션이
  // 남아있는 것처럼 보인다. AndroidManifest의 android:allowBackup="false"
  // 로 백업 자체를 막아 fresh install에서는 빈 상태가 보장되도록 함께 설정함.
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
      <BottomSheetModalProvider>
        <AudioPlayerProvider>
          <AppInitializer />
          <ThemedStatusBar />
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
            <Stack.Screen name="settings" />
          </Stack>
        </AudioPlayerProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
