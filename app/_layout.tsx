import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AudioPlayerProvider } from '@/context/audio-player-context';
import { usePlayerStore } from '@/store/player-store';
import { useMediaLibrary } from '@/hooks/use-media-library';

function AppInitializer() {
  useMediaLibrary();
  const { lastQueue, lastTrackIndex, lastPosition, restoreQueue } = usePlayerStore();

  // 앱 시작 시 마지막 재생 큐/곡 복원
  useEffect(() => {
    if (lastQueue.length > 0) {
      restoreQueue(lastQueue, lastTrackIndex, lastPosition);
    }
  }, [lastPosition, lastQueue, lastTrackIndex, restoreQueue]);

  return null;
}

export default function RootLayout() {
  return (
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
        <Stack.Screen name="playlist/[id]" />
      </Stack>
    </AudioPlayerProvider>
  );
}
