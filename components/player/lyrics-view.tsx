import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { findActiveLineIndex, type ParsedLyrics } from '@/lib/lyrics/lrc-parser';
import type { LyricsStatus } from '@/hooks/use-lyrics';

interface LyricsViewProps {
  status: LyricsStatus;
  lyrics: ParsedLyrics | null;
  // 현재 재생 위치(ms). synced 가사일 때 활성 라인 계산에 사용.
  positionMs: number;
  // 부모(풀스크린 플레이어)가 차지하라고 허락한 높이. 시안에서는 ARTWORK_SIZE 와
  // 동일하게 줘서 토글 시 레이아웃 점프가 안 보이도록 한다.
  height: number;
}

// 활성 라인이 컨테이너의 약 1/3 지점에 오도록 스크롤한다 — 다음 라인을 미리 읽을 수 있게.
const ACTIVE_LINE_OFFSET_RATIO = 0.35;
// 라인 높이 추정값. 실제론 줄바꿈에 따라 가변이지만, scroll-to 는 추정만 있어도 됨.
const ESTIMATED_LINE_HEIGHT = 28;

export function LyricsView({ status, lyrics, positionMs, height }: LyricsViewProps) {
  const scrollRef = useRef<ScrollView | null>(null);
  const lastScrolledIndexRef = useRef<number>(-1);

  const activeIndex = useMemo(() => {
    if (!lyrics) return -1;
    return findActiveLineIndex(lyrics, positionMs);
  }, [lyrics, positionMs]);

  useEffect(() => {
    if (!lyrics?.synced) return;
    if (activeIndex < 0) return;
    if (activeIndex === lastScrolledIndexRef.current) return;
    lastScrolledIndexRef.current = activeIndex;

    const targetY = Math.max(
      0,
      activeIndex * ESTIMATED_LINE_HEIGHT - height * ACTIVE_LINE_OFFSET_RATIO,
    );
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  }, [activeIndex, lyrics?.synced, height]);

  if (status === 'loading') {
    return (
      <View style={[styles.message, { height }]}>
        <Text style={styles.messageText}>가사 불러오는 중…</Text>
      </View>
    );
  }

  if (status === 'missing') {
    return (
      <View style={[styles.message, { height }]}>
        <Text style={styles.messageText}>가사 없음</Text>
        <Text style={styles.messageHint}>
          곡 파일과 같은 폴더에 같은 이름의 .lrc 파일을 두면 자동으로 표시됩니다.
        </Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.message, { height }]}>
        <Text style={styles.messageText}>가사를 불러오지 못했습니다</Text>
      </View>
    );
  }

  if (!lyrics || lyrics.lines.length === 0) {
    return (
      <View style={[styles.message, { height }]}>
        <Text style={styles.messageText}>가사 없음</Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.container, { height }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {lyrics.lines.map((line, index) => {
        // 비동기 가사면 active 강조 없음 — 모두 동일 톤으로 표시.
        const isActive = lyrics.synced && index === activeIndex;
        return (
          <Text
            key={`${index}-${line.timeMs ?? 'n'}`}
            style={[styles.line, isActive && styles.lineActive]}
          >
            {line.text.length === 0 ? ' ' : line.text}
          </Text>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  content: {
    paddingVertical: 12,
    gap: 6,
  },
  line: {
    color: '#999',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  lineActive: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '700',
  },
  message: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  messageText: {
    color: '#bbb',
    fontSize: 15,
    fontWeight: '600',
  },
  messageHint: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
