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
const paletteCache = new Map<string, ArtworkPalette>();

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
        paletteCache.set(artworkUri, next);
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
