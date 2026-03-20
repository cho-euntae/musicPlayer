const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const patches = [
  {
    file: path.join(rootDir, 'node_modules/expo/src/launch/withDevTools.tsx'),
    from: `  // This hook can be optionally imported because __DEV__ never changes during runtime.
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
    to: `  const useOptionalKeepAwake: (tag?: string) => void = () => {};
`,
  },
];

for (const patch of patches) {
  if (!fs.existsSync(patch.file)) {
    continue;
  }

  const contents = fs.readFileSync(patch.file, 'utf8');
  if (contents.includes("const useOptionalKeepAwake: (tag?: string) => void = () => {};")) {
    continue;
  }

  if (!contents.includes(patch.from)) {
    throw new Error(`Patch target not found: ${patch.file}`);
  }

  fs.writeFileSync(patch.file, contents.replace(patch.from, patch.to), 'utf8');
  console.log(`Patched ${path.relative(rootDir, patch.file)}`);
}
