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
