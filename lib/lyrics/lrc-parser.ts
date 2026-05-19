// LRC(.lrc) 가사 파서.
//
// 지원 형식:
//   [mm:ss.xx]가사
//   [mm:ss.xxx]가사
//   [mm:ss]가사
//   [mm:ss.xx][mm:ss.xx]가사   (한 줄에 여러 타임스탬프)
//   [ti:제목] / [ar:아티스트] / [al:앨범] / [by:제작자]  (메타데이터, 본문에서 제외)
//   [offset:+100]              (전체 시간 오프셋 ms, 양수면 가사를 늦춤)
//
// 비-동기화 가사(타임스탬프 없는 일반 텍스트)는 시간 없이 본문만 보관해
// "한 줄씩 흘러가지 않는" 정적 가사로 렌더할 수 있게 한다.

export interface LyricLine {
  // ms 단위. 비동기 가사일 때만 null.
  timeMs: number | null;
  text: string;
}

export interface ParsedLyrics {
  // 메타데이터 — 없으면 undefined.
  title?: string;
  artist?: string;
  album?: string;
  // 동기화 여부. timeMs 가 하나라도 있으면 true.
  synced: boolean;
  // timeMs 오름차순 정렬된 라인 목록. 비동기일 땐 입력 순서.
  lines: LyricLine[];
}

const TIMESTAMP_RE = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const META_RE = /^\[(ti|ar|al|by|offset):\s*(.*?)\]\s*$/i;

function parseTimestamps(line: string): { times: number[]; rest: string } {
  const times: number[] = [];
  TIMESTAMP_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  while ((match = TIMESTAMP_RE.exec(line)) !== null) {
    const minutes = Number.parseInt(match[1], 10);
    const seconds = Number.parseInt(match[2], 10);
    const fracStr = match[3] ?? '';
    // [mm:ss.xx] 는 1/100초, [mm:ss.xxx] 는 1/1000초.
    // 길이에 맞춰 보정.
    let fracMs = 0;
    if (fracStr.length === 1) fracMs = Number.parseInt(fracStr, 10) * 100;
    else if (fracStr.length === 2) fracMs = Number.parseInt(fracStr, 10) * 10;
    else if (fracStr.length >= 3) fracMs = Number.parseInt(fracStr.slice(0, 3), 10);

    const ms = (minutes * 60 + seconds) * 1000 + fracMs;
    times.push(ms);
    lastIndex = TIMESTAMP_RE.lastIndex;
  }
  const rest = line.slice(lastIndex).trim();
  return { times, rest };
}

/**
 * LRC 텍스트를 파싱한다.
 * 잘못된 라인은 조용히 무시 — 부분 손상된 파일도 가능한 만큼 살린다.
 */
export function parseLrc(raw: string): ParsedLyrics {
  const result: ParsedLyrics = {
    synced: false,
    lines: [],
  };

  if (typeof raw !== 'string' || raw.length === 0) {
    return result;
  }

  let offsetMs = 0;
  const rawLines = raw.replace(/\r\n?/g, '\n').split('\n');
  const collected: LyricLine[] = [];
  const fallbackText: string[] = [];
  let anyTimestamp = false;

  for (const original of rawLines) {
    const line = original.trim();
    if (line.length === 0) continue;

    const metaMatch = line.match(META_RE);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim();
      switch (key) {
        case 'ti':
          result.title = value;
          break;
        case 'ar':
          result.artist = value;
          break;
        case 'al':
          result.album = value;
          break;
        case 'offset': {
          const parsed = Number.parseInt(value, 10);
          if (Number.isFinite(parsed)) offsetMs = parsed;
          break;
        }
        case 'by':
          // 제작자 메타는 저장하지 않는다.
          break;
      }
      continue;
    }

    const { times, rest } = parseTimestamps(line);
    if (times.length === 0) {
      // 타임스탬프 없는 일반 텍스트 — 비동기 가사 후보로 보관.
      fallbackText.push(line);
      continue;
    }

    anyTimestamp = true;
    for (const time of times) {
      collected.push({ timeMs: time, text: rest });
    }
  }

  if (anyTimestamp) {
    // offset 적용 후 시간순 정렬. 음수 시간은 0 으로 클램프.
    const adjusted = collected.map((entry) => ({
      ...entry,
      timeMs: Math.max(0, (entry.timeMs ?? 0) + offsetMs),
    }));
    adjusted.sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
    result.synced = true;
    result.lines = adjusted;
  } else if (fallbackText.length > 0) {
    result.synced = false;
    result.lines = fallbackText.map((text) => ({ timeMs: null, text }));
  }

  return result;
}

/**
 * 현재 재생 위치(ms)에 해당하는 라인 인덱스를 이진 탐색으로 찾는다.
 * - synced=false 면 항상 -1 (활성 라인 개념 없음)
 * - 첫 라인보다 이전이면 -1 (인트로 구간)
 * - 그 외에는 timeMs <= positionMs 를 만족하는 가장 늦은 라인
 */
export function findActiveLineIndex(
  lyrics: Readonly<ParsedLyrics>,
  positionMs: number,
): number {
  if (!lyrics.synced || lyrics.lines.length === 0) return -1;
  if (positionMs < (lyrics.lines[0].timeMs ?? 0)) return -1;

  let lo = 0;
  let hi = lyrics.lines.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const t = lyrics.lines[mid].timeMs ?? 0;
    if (t <= positionMs) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}
