import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AudioPlayerProvider } from '@/context/audio-player-context';
import { usePlayerStore } from '@/store/player-store';
import { useMediaLibrary } from '@/hooks/use-media-library';
import { useTheme } from '@/hooks/use-theme';
// playback service 등록은 진입점(index.js)에서 처리한다.
// 헤드리스 알림 액션 시 이 컴포넌트는 마운트되지 않기 때문이다.

// 네이티브 splash가 RN 첫 paint 시점에 자동으로 사라지도록 두면, New Architecture +
// React Compiler 조합에서 가끔 race가 나서 splash가 그대로 남는 케이스가 있었다
// (재설치 직후처럼 캐시가 비어 첫 부팅이 느릴 때 특히). 그래서 모듈 로드 시점에
// 자동 hide를 막아두고, RootLayout이 한 번 마운트되면 명시적으로 숨긴다.
// catch는 의도적으로 swallow — splash가 이미 사라졌어도 문제 없도록.
SplashScreen.preventAutoHideAsync().catch(() => {
  // 이미 숨겨졌거나 호출 가능 시점이 지나간 경우. 사용자 영향 없음.
});

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
  // 컴포넌트 트리가 한 번이라도 마운트되어 첫 렌더가 잡혔다는 신호로 splash를 내린다.
  // AsyncStorage hydration이나 TrackPlayer setup을 기다리지 않는 이유:
  //  - 그 작업들은 비동기로 백그라운드에서 진행되고, splash를 그동안 띄워둘 필요는 없다.
  //  - 오히려 외부 요인(권한 다이얼로그 미응답, 네이티브 모듈 초기화 실패 등)으로
  //    영원히 splash에 갇히는 사고를 막는 게 더 중요.
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {
      // 이미 숨겨진 상태. 무시.
    });
  }, []);

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
            <Stack.Screen name="trainer/mic-test" />
            <Stack.Screen name="trainer/range-test" />
            <Stack.Screen name="trainer/scale-practice" />
          </Stack>
        </AudioPlayerProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
