import { useEffect, useRef, useState } from 'react';

import { findLrcForTrack } from '@/lib/lyrics/lrc-finder';
import { parseLrc, type ParsedLyrics } from '@/lib/lyrics/lrc-parser';

export type LyricsStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

export interface LyricsState {
  status: LyricsStatus;
  lyrics: ParsedLyrics | null;
  // 마지막 로딩 실패 사유 (디버깅용). UI 는 status 만 봐도 충분.
  errorMessage?: string;
}

const INITIAL_STATE: LyricsState = { status: 'idle', lyrics: null };

// 같은 트랙을 다시 펼칠 때 재읽기/재파싱 비용을 피하기 위한 인메모리 캐시.
// 라이브러리 전체를 캐싱하지 않도록 LRU 형태로 최근 N개만 유지.
const CACHE_LIMIT = 16;
const cache = new Map<string, LyricsState>();

function rememberInCache(key: string, value: LyricsState): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

/**
 * 트랙 URI 옆 .lrc 파일을 찾아 파싱한다.
 *
 * - trackUri 가 바뀌면 자동으로 다시 로드.
 * - file:// 가 아닌 URI (예: content://, ph://) 는 즉시 missing.
 * - 결과는 인메모리 캐시. 트랙이 라이브러리에서 사라지면 캐시도 무의미해지지만,
 *   재스캔 흐름에선 URI 자체가 바뀌므로 stale 키는 자연스럽게 LRU 로 밀려난다.
 */
export function useLyrics(trackUri: string | undefined): LyricsState {
  const [state, setState] = useState<LyricsState>(() => {
    if (!trackUri) return INITIAL_STATE;
    return cache.get(trackUri) ?? INITIAL_STATE;
  });
  // 빠른 트랙 전환 중에 이전 fetch 결과가 늦게 도착해 새 트랙 상태를 덮어쓰지
  // 않도록 epoch 카운터로 가드.
  const epochRef = useRef(0);

  useEffect(() => {
    if (!trackUri) {
      setState(INITIAL_STATE);
      return;
    }

    const cached = cache.get(trackUri);
    if (cached) {
      setState(cached);
      return;
    }

    const myEpoch = ++epochRef.current;
    setState({ status: 'loading', lyrics: null });

    void (async () => {
      try {
        const raw = await findLrcForTrack(trackUri);
        if (myEpoch !== epochRef.current) return;

        if (raw === null) {
          const next: LyricsState = { status: 'missing', lyrics: null };
          rememberInCache(trackUri, next);
          setState(next);
          return;
        }

        const parsed = parseLrc(raw);
        const next: LyricsState =
          parsed.lines.length === 0
            ? { status: 'missing', lyrics: null }
            : { status: 'ready', lyrics: parsed };
        rememberInCache(trackUri, next);
        setState(next);
      } catch (error) {
        if (myEpoch !== epochRef.current) return;
        const message = error instanceof Error ? error.message : String(error);
        // 에러는 캐시하지 않는다 — 일시적 IO 실패면 다음 번엔 성공할 수 있음.
        setState({ status: 'error', lyrics: null, errorMessage: message });
      }
    })();
  }, [trackUri]);

  return state;
}
