// 트랙 URI 옆에 같은 이름의 .lrc 파일이 있는지 찾는다.
//
// expo-media-library 가 돌려주는 asset.uri 는 안드로이드에선 보통 file:// 경로.
// content:// 같은 SAF URI 는 부모 디렉터리 탐색이 불가능하므로 null 반환 → 호출자가
// "가사 없음" 으로 처리하도록 한다.

import * as FileSystem from 'expo-file-system/legacy';

const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus'];

interface Candidate {
  dir: string;
  base: string; // 확장자 제거된 파일명
}

function decode(uri: string): string {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

function splitFileUri(uri: string): Candidate | null {
  // file:// 만 다룬다. content://, ph://, https:// 등은 직접 탐색 불가.
  if (!uri.startsWith('file://')) return null;

  const decoded = decode(uri);
  const slash = decoded.lastIndexOf('/');
  if (slash === -1) return null;

  const dir = decoded.slice(0, slash + 1);
  const filename = decoded.slice(slash + 1);
  if (filename.length === 0) return null;

  const dot = filename.lastIndexOf('.');
  const ext = dot === -1 ? '' : filename.slice(dot).toLowerCase();
  const base = dot === -1 ? filename : filename.slice(0, dot);

  // 오디오 확장자가 아닌 트랙은 가사 매칭 후보가 아님.
  if (ext.length > 0 && !SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) return null;

  return { dir, base };
}

async function readIfExists(path: string): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists || info.isDirectory) return null;
  return FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
}

/**
 * 트랙 URI 와 같은 디렉터리에서 .lrc 파일을 찾아 본문을 돌려준다.
 * 못 찾거나 file:// 가 아니면 null.
 *
 * 검색 순서:
 *   1) 정확히 같은 base name (예: song.mp3 → song.lrc)
 *   2) 같은 base name 의 대문자 확장자 (.LRC)
 */
export async function findLrcForTrack(trackUri: string): Promise<string | null> {
  const candidate = splitFileUri(trackUri);
  if (!candidate) return null;

  const { dir, base } = candidate;
  const variants = [`${dir}${base}.lrc`, `${dir}${base}.LRC`];

  for (const path of variants) {
    try {
      const contents = await readIfExists(path);
      if (contents !== null) return contents;
    } catch {
      // 한 후보 실패는 무시하고 다음 후보로.
    }
  }

  return null;
}
