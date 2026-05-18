const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function replaceOnce(contents, from, to, label) {
  if (!contents.includes(from)) {
    return { contents, changed: false };
  }

  return {
    contents: contents.replace(from, to),
    changed: true,
    label,
  };
}

function patchExpoDevTools(contents) {
  return replaceOnce(
    contents,
    `  // This hook can be optionally imported because __DEV__ never changes during runtime.
  // Using __DEV__ like this enables tree shaking to remove the hook in production.
  const useOptionalKeepAwake: (tag?: string) => void = (() => {
    try {
      // Optionally import expo-keep-awake
      const { useKeepAwake, ExpoKeepAwakeTag } = require('expo-keep-awake');
      return () => useKeepAwake(ExpoKeepAwakeTag, { suppressDeactivateWarnings: true });
    } catch {}
    return () => {};
  })();
`,
    `  const useOptionalKeepAwake: (tag?: string) => void = () => {};
`,
    'expo dev tools patch'
  );
}

function patchTrackPlayerNullability(contents) {
  let next = replaceOnce(
    contents,
    `        if (index >= 0 && index < musicService.tracks.size) {
            callback.resolve(Arguments.fromBundle(musicService.tracks[index].originalItem))
        } else {
            callback.resolve(null)
        }
`,
    `        if (index >= 0 && index < musicService.tracks.size) {
            val originalItem = musicService.tracks[index].originalItem
            callback.resolve(originalItem?.let { Arguments.fromBundle(it) })
        } else {
            callback.resolve(null)
        }
`,
    'track-player getTrack nullability patch'
  );

  const nextStep = replaceOnce(
    next.contents,
    `        callback.resolve(
            if (musicService.tracks.isEmpty()) null
            else Arguments.fromBundle(
                musicService.tracks[musicService.getCurrentTrackIndex()].originalItem
            )
        )
`,
    `        val originalItem = musicService.tracks
            .getOrNull(musicService.getCurrentTrackIndex())
            ?.originalItem
        callback.resolve(originalItem?.let { Arguments.fromBundle(it) })
`,
    'track-player getActiveTrack nullability patch'
  );

  return {
    contents: nextStep.contents,
    changed: next.changed || nextStep.changed,
  };
}

// New Architecture(Bridgeless) 환경에서 RNTP 4.1.x의 MusicService.emit() 가
// reactNativeHost.reactInstanceManager.currentReactContext 만 참조해 null 을
//돌려주는 버그를 우회한다. Bridgeless 에서는 reactInstanceManager 가 없고
// reactHost 가 ReactContext 를 들고 있으므로 그쪽을 먼저 본다.
//
// 증상:
//   - 알림센터/잠금화면의 재생/일시정지/이전/다음 버튼이 시각적으로는 눌리지만
//     RemotePlay/RemotePause/RemoteNext/RemotePrevious 이벤트가 JS 로 오지 않음.
//   - newArchEnabled: true 인 RN 0.74+ 환경에서만 발생.
function patchTrackPlayerBridgelessEmit(contents) {
  const oldEmit = `    @MainThread
    private fun emit(event: String, data: Bundle? = null) {
        reactNativeHost.reactInstanceManager.currentReactContext
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(event, data?.let { Arguments.fromBundle(it) })
    }

    @MainThread
    private fun emitList(event: String, data: List<Bundle> = emptyList()) {
        val payload = Arguments.createArray()
        data.forEach { payload.pushMap(Arguments.fromBundle(it)) }

        reactNativeHost.reactInstanceManager.currentReactContext
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(event, payload)
    }`;

  const newEmit = `    /* etmusic:bridgeless-emit */
    @MainThread
    private fun resolveReactContext(): com.facebook.react.bridge.ReactContext? {
        // Bridgeless(New Architecture) 우선, 실패 시 legacy 경로 fallback.
        return try {
            reactHost?.currentReactContext
        } catch (_: Throwable) {
            null
        } ?: try {
            reactNativeHost.reactInstanceManager.currentReactContext
        } catch (_: Throwable) {
            null
        }
    }

    @MainThread
    private fun emit(event: String, data: Bundle? = null) {
        resolveReactContext()
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(event, data?.let { Arguments.fromBundle(it) })
    }

    @MainThread
    private fun emitList(event: String, data: List<Bundle> = emptyList()) {
        val payload = Arguments.createArray()
        data.forEach { payload.pushMap(Arguments.fromBundle(it)) }

        resolveReactContext()
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(event, payload)
    }`;

  if (contents.includes('/* etmusic:bridgeless-emit */')) {
    return { contents, changed: false };
  }

  return replaceOnce(contents, oldEmit, newEmit, 'track-player bridgeless emit patch');
}

function patchTrackPlayerTurboModuleInterop(contents) {
  if (!contents.includes('= scope.launch {')) {
    return { contents, changed: false };
  }

  const lines = contents.split('\n');
  const updatedLines = [];
  let changed = false;
  let launchDepth = null;

  for (const line of lines) {
    if (launchDepth === null && line.includes('= scope.launch {')) {
      updatedLines.push(line.replace('= scope.launch {', '{'));
      updatedLines.push('        scope.launch {');
      launchDepth = 1;
      changed = true;
      continue;
    }

    updatedLines.push(line);

    if (launchDepth !== null) {
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      launchDepth += opens - closes;

      if (launchDepth === 0) {
        updatedLines.push('    }');
        launchDepth = null;
      }
    }
  }

  const updated = updatedLines.join('\n');
  return {
    contents: updated,
    changed,
  };
}

const patchers = [
  {
    file: path.join(rootDir, 'node_modules/expo/src/launch/withDevTools.tsx'),
    apply: patchExpoDevTools,
  },
  {
    file: path.join(
      rootDir,
      'node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/module/MusicModule.kt'
    ),
    apply: (contents) => {
      const nullability = patchTrackPlayerNullability(contents);
      const turboModule = patchTrackPlayerTurboModuleInterop(nullability.contents);
      return {
        contents: turboModule.contents,
        changed: nullability.changed || turboModule.changed,
      };
    },
  },
  {
    file: path.join(
      rootDir,
      'node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/service/MusicService.kt'
    ),
    apply: patchTrackPlayerBridgelessEmit,
  },
];

for (const patch of patchers) {
  if (!fs.existsSync(patch.file)) {
    continue;
  }

  const original = fs.readFileSync(patch.file, 'utf8');
  const result = patch.apply(original);

  if (!result.changed) {
    continue;
  }

  fs.writeFileSync(patch.file, result.contents, 'utf8');
  console.log(`Patched ${path.relative(rootDir, patch.file)}`);
}
