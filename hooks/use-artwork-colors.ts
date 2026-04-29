import { useEffect, useState } from 'react';
import { getColors, type ImageColorsResult } from 'react-native-image-colors';

export interface ArtworkPalette {
  // 풀스크린 배경 그라디언트의 윗부분
  primary: string;
  // 풀스크린 배경 그라디언트의 가운데
  secondary: string;
  // 컨트롤/하이라이트에 활용 가능한 강조색
  accent: string;
}

// artwork가 없거나 추출 실패 시 사용할 다크 톤 fallback.
// 앱의 기존 배경(#121212)과 자연스럽게 어울리도록 잡았다.
const FALLBACK_PALETTE: ArtworkPalette = {
  primary: '#1a1a1a',
  secondary: '#0f0f0f',
  accent: '#1DB954',
};

// URI -> 팔레트 메모이즈 캐시. 같은 곡으로 돌아올 때 재계산 비용 절감.
// 큰 라이브러리에서 캐시가 무한정 커지는 것을 막기 위해 가장 오래된 항목부터
// 제거하는 단순 LRU 정책 사용 (Map은 삽입 순서를 유지함).
const PALETTE_CACHE_MAX_SIZE = 256;
const paletteCache = new Map<string, ArtworkPalette>();

function setCachedPalette(uri: string, palette: ArtworkPalette) {
  // 이미 존재하면 최근 사용으로 갱신하기 위해 일단 삭제 후 재삽입.
  paletteCache.delete(uri);
  paletteCache.set(uri, palette);

  while (paletteCache.size > PALETTE_CACHE_MAX_SIZE) {
    const oldestKey = paletteCache.keys().next().value;
    if (oldestKey === undefined) break;
    paletteCache.delete(oldestKey);
  }
}

function mapToPalette(result: ImageColorsResult): ArtworkPalette {
  if (result.platform === 'android') {
    return {
      primary: result.dominant ?? FALLBACK_PALETTE.primary,
      secondary:
        result.darkVibrant ?? result.darkMuted ?? FALLBACK_PALETTE.secondary,
      accent:
        result.vibrant ?? result.lightVibrant ?? FALLBACK_PALETTE.accent,
    };
  }
  if (result.platform === 'ios') {
    return {
      primary: result.background ?? FALLBACK_PALETTE.primary,
      secondary: result.detail ?? FALLBACK_PALETTE.secondary,
      accent: result.primary ?? FALLBACK_PALETTE.accent,
    };
  }
  return FALLBACK_PALETTE;
}

// 트랙의 artwork URI에서 dominant 색을 추출해 풀스크린 플레이어 배경 등에 사용.
// 추출 실패는 조용히 fallback으로 떨어지므로 호출자는 별도 에러 처리 불필요.
export function useArtworkColors(
  artworkUri: string | undefined,
): ArtworkPalette {
  const [palette, setPalette] = useState<ArtworkPalette>(() =>
    artworkUri && paletteCache.has(artworkUri)
      ? paletteCache.get(artworkUri)!
      : FALLBACK_PALETTE,
  );

  useEffect(() => {
    if (!artworkUri) {
      setPalette(FALLBACK_PALETTE);
      return;
    }

    const cached = paletteCache.get(artworkUri);
    if (cached) {
      setPalette(cached);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const result = await getColors(artworkUri, {
          fallback: FALLBACK_PALETTE.primary,
          cache: true,
          key: artworkUri,
        });
        if (cancelled) return;

        const next = mapToPalette(result);
        setCachedPalette(artworkUri, next);
        setPalette(next);
      } catch {
        // artwork URI가 깨졌거나 권한 문제 등인 경우 fallback 유지.
        if (cancelled) return;
        setPalette(FALLBACK_PALETTE);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [artworkUri]);

  return palette;
}
