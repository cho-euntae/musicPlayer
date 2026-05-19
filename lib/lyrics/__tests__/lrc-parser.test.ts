import { findActiveLineIndex, parseLrc } from '../lrc-parser';

describe('parseLrc', () => {
  it('빈 문자열은 라인이 0개인 비동기 결과', () => {
    const result = parseLrc('');
    expect(result.synced).toBe(false);
    expect(result.lines).toHaveLength(0);
  });

  it('[mm:ss.xx] 한 줄을 ms 로 변환', () => {
    const result = parseLrc('[00:12.34]hello');
    expect(result.synced).toBe(true);
    expect(result.lines).toEqual([{ timeMs: 12_340, text: 'hello' }]);
  });

  it('[mm:ss.xxx] 밀리초 정밀도', () => {
    const result = parseLrc('[01:02.345]ms test');
    expect(result.lines[0].timeMs).toBe(62_345);
  });

  it('[mm:ss] 소수점 없는 형태', () => {
    const result = parseLrc('[02:30]half hour');
    expect(result.lines[0].timeMs).toBe(150_000);
  });

  it('[mm:ss:xx] 콜론 구분자도 허용', () => {
    const result = parseLrc('[00:05:50]colon');
    expect(result.lines[0].timeMs).toBe(5_500);
  });

  it('한 줄에 여러 타임스탬프 → 라인 복제', () => {
    const result = parseLrc('[00:01.00][00:05.00][00:09.00]chorus');
    expect(result.lines).toEqual([
      { timeMs: 1_000, text: 'chorus' },
      { timeMs: 5_000, text: 'chorus' },
      { timeMs: 9_000, text: 'chorus' },
    ]);
  });

  it('역순 입력도 시간순 정렬', () => {
    const result = parseLrc('[00:05.00]b\n[00:01.00]a');
    expect(result.lines.map((l) => l.text)).toEqual(['a', 'b']);
  });

  it('메타데이터 추출 + 본문에서 제외', () => {
    const result = parseLrc(
      ['[ti:Title]', '[ar:Artist]', '[al:Album]', '[by:Creator]', '[00:01.00]line'].join('\n'),
    );
    expect(result.title).toBe('Title');
    expect(result.artist).toBe('Artist');
    expect(result.album).toBe('Album');
    expect(result.lines).toHaveLength(1);
  });

  it('[offset:+500] 양수면 가사가 500ms 늦춰짐', () => {
    const result = parseLrc('[offset:+500]\n[00:01.00]a');
    expect(result.lines[0].timeMs).toBe(1_500);
  });

  it('[offset:-2000] 음수 결과는 0으로 클램프', () => {
    const result = parseLrc('[offset:-2000]\n[00:01.00]a');
    expect(result.lines[0].timeMs).toBe(0);
  });

  it('타임스탬프 없는 텍스트만 있으면 synced=false', () => {
    const result = parseLrc('hello\nworld\n');
    expect(result.synced).toBe(false);
    expect(result.lines.map((l) => l.text)).toEqual(['hello', 'world']);
    expect(result.lines.every((l) => l.timeMs === null)).toBe(true);
  });

  it('synced 라인이 하나라도 있으면 비-synced 라인은 버린다', () => {
    const result = parseLrc('not timed\n[00:01.00]timed');
    expect(result.synced).toBe(true);
    expect(result.lines.map((l) => l.text)).toEqual(['timed']);
  });

  it('CRLF 줄바꿈도 처리', () => {
    const result = parseLrc('[00:01.00]a\r\n[00:02.00]b\r\n');
    expect(result.lines.map((l) => l.text)).toEqual(['a', 'b']);
  });

  it('빈 가사 텍스트(간주 마커)도 라인으로 보존', () => {
    const result = parseLrc('[00:01.00]\n[00:02.00]sing');
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].text).toBe('');
  });
});

describe('findActiveLineIndex', () => {
  const synced = parseLrc(['[00:01.000]a', '[00:03.000]b', '[00:05.000]c'].join('\n'));

  it('첫 라인 시작 전이면 -1', () => {
    expect(findActiveLineIndex(synced, 0)).toBe(-1);
    expect(findActiveLineIndex(synced, 999)).toBe(-1);
  });

  it('정확히 라인 시작 시각이면 그 라인', () => {
    expect(findActiveLineIndex(synced, 1_000)).toBe(0);
    expect(findActiveLineIndex(synced, 3_000)).toBe(1);
  });

  it('라인 사이 구간이면 직전 라인', () => {
    expect(findActiveLineIndex(synced, 2_500)).toBe(0);
    expect(findActiveLineIndex(synced, 4_999)).toBe(1);
  });

  it('마지막 라인 이후도 마지막 라인을 유지', () => {
    expect(findActiveLineIndex(synced, 999_999)).toBe(2);
  });

  it('비동기 가사는 항상 -1', () => {
    const async = parseLrc('plain text\nmore');
    expect(findActiveLineIndex(async, 5_000)).toBe(-1);
  });

  it('빈 가사는 -1', () => {
    const empty = parseLrc('');
    expect(findActiveLineIndex(empty, 1_000)).toBe(-1);
  });
});
