import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

// 앨범 아트가 없을 때 트랙 ID 기반으로 일관된 색상을 부여하기 위한 팔레트.
// 다크 톤을 유지해 흰색 글자(트랙명 첫 글자)와의 대비를 확보한다.
const FALLBACK_PALETTE = [
  '#1e3a8a',
  '#7c2d12',
  '#14532d',
  '#831843',
  '#581c87',
  '#155e75',
  '#713f12',
  '#1e1b4b',
  '#3f3f46',
  '#7f1d1d',
  '#064e3b',
  '#9d174d',
];

function pickFallbackColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[index];
}

function pickInitial(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return '♪';
  // 한글, 영문, 숫자, 그 외 모두 첫 문자 한 글자 사용.
  const firstChar = Array.from(trimmed)[0];
  return firstChar.toUpperCase();
}

interface TrackArtworkProps {
  artwork?: string;
  title: string;
  trackId: string;
  size: number;
  borderRadius?: number;
  active?: boolean;
}

export function TrackArtwork({
  artwork,
  title,
  trackId,
  size,
  borderRadius = 6,
  active = false,
}: TrackArtworkProps) {
  const [hasFailed, setHasFailed] = useState(false);

  // artwork URI가 바뀌면 실패 상태를 초기화한다 (트랙 변경 시 재시도).
  useEffect(() => {
    setHasFailed(false);
  }, [artwork]);

  const showImage = Boolean(artwork) && !hasFailed;
  const fallbackColor = pickFallbackColor(trackId || title || 'unknown');
  const initial = pickInitial(title);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: fallbackColor,
        },
        active && styles.containerActive,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: artwork }}
          style={{ width: size, height: size, borderRadius }}
          onError={() => setHasFailed(true)}
        />
      ) : (
        <Text
          style={[
            styles.initial,
            { fontSize: Math.max(12, size * 0.42) },
          ]}
          numberOfLines={1}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  containerActive: {
    borderWidth: 2,
    borderColor: '#1DB954',
  },
  initial: {
    color: '#fff',
    fontWeight: '700',
  },
});
