import * as FileSystem from 'expo-file-system/legacy';
import { A4_FREQ, A4_MIDI } from './notes';

// 16-bit PCM mono WAV을 메모리에서 만들어 cache 디렉토리에 쓰고 file:// URI를 돌려준다.
//
// 왜 직접 만드냐:
//  - expo-audio는 파일 URL/asset에서 재생할 수 있지만, RN에는 Web Audio가
//    없어 OscillatorNode 같은 합성기가 없다. 짧은 사인파를 외부 의존성 없이
//    얻으려면 PCM을 직접 합성하는 게 가장 가볍다.
//  - 미리 모든 음을 번들에 넣는 방식은 50개 가량의 작은 wav 파일을 자산에
//    추가해야 해 무겁고 추후 옥타브 추가가 번거롭다.
//
// 구현 메모:
//  - 16kHz 샘플레이트면 1초 ≈ 32KB. 캐시에 가볍게 남겨도 부담 없다.
//  - 어택/릴리즈에 짧은 페이드(20ms)를 줘서 시작/끝 클릭 노이즈 제거.

const SAMPLE_RATE = 16000;
const FADE_MS = 20;

interface SineOptions {
  frequency: number;
  durationMs: number;
  amplitude?: number; // 0..1
}

function buildSineWavBuffer({ frequency, durationMs, amplitude = 0.6 }: SineOptions): Uint8Array {
  const numSamples = Math.floor((SAMPLE_RATE * durationMs) / 1000);
  const fadeSamples = Math.floor((SAMPLE_RATE * FADE_MS) / 1000);
  const dataBytes = numSamples * 2; // 16-bit mono
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);              // PCM chunk size
  view.setUint16(20, 1, true);               // format = PCM
  view.setUint16(22, 1, true);               // channels = 1
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true);               // block align
  view.setUint16(34, 16, true);              // bits per sample

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  const twoPiF = 2 * Math.PI * frequency;
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let env = amplitude;
    if (i < fadeSamples) env *= i / fadeSamples;
    else if (i > numSamples - fadeSamples) env *= (numSamples - i) / fadeSamples;

    const sample = Math.sin(twoPiF * t) * env;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  // RN 환경에 native btoa가 없을 수 있어 수동 인코딩.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    result += chars[a >> 2];
    result += chars[((a & 0x03) << 4) | (b >> 4)];
    result += chars[((b & 0x0f) << 2) | (c >> 6)];
    result += chars[c & 0x3f];
  }
  if (i < bytes.length) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    result += chars[a >> 2];
    result += chars[((a & 0x03) << 4) | (b >> 4)];
    if (i + 1 < bytes.length) {
      result += chars[(b & 0x0f) << 2];
      result += '=';
    } else {
      result += '==';
    }
  }
  return result;
}

// 같은 음/길이 조합은 캐시 재사용해서 매번 디스크 쓰기를 피한다.
//
// 캐시 키 설계:
//  - 과거에는 `Math.round(frequencyHz * 100)` 기반이라 부동소수점 오차로 같은
//    음이 다른 키가 될 수 있었다. 이제는 MIDI 정수 번호를 1차 키로 쓴다.
//  - frequency 그대로 받는 호환 호출은 가장 가까운 MIDI로 양자화한다.
//
// LRU 제한:
//  - 측정/연습을 반복하면 wav 메타가 메모리에 누적되므로 50개로 제한한다.
//  - 디스크 파일 자체는 OS의 cache cleanup에 맡긴다 (재계산 가능한 자산).
const MEMO_CAPACITY = 50;
const memoUriByKey = new Map<string, string>();

function rememberMemo(key: string, uri: string): void {
  // Map은 삽입 순서를 유지하므로, 재참조 시 delete→set으로 LRU 갱신.
  if (memoUriByKey.has(key)) memoUriByKey.delete(key);
  memoUriByKey.set(key, uri);
  while (memoUriByKey.size > MEMO_CAPACITY) {
    const oldest = memoUriByKey.keys().next().value;
    if (oldest === undefined) break;
    memoUriByKey.delete(oldest);
  }
}

function getMemo(key: string): string | undefined {
  const uri = memoUriByKey.get(key);
  if (uri !== undefined) {
    // 재사용 시 LRU 갱신.
    memoUriByKey.delete(key);
    memoUriByKey.set(key, uri);
  }
  return uri;
}

function nearestMidi(frequencyHz: number): number {
  if (frequencyHz <= 0) return A4_MIDI;
  return Math.round(A4_MIDI + 12 * Math.log2(frequencyHz / A4_FREQ));
}

async function buildAndWriteFile(uri: string, frequencyHz: number, durationMs: number): Promise<void> {
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (fileInfo.exists) return;
  const bytes = buildSineWavBuffer({ frequency: frequencyHz, durationMs });
  const base64 = bytesToBase64(bytes);
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

async function ensureCacheDir(): Promise<string> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error('cacheDirectory 사용 불가');
  const dir = `${cacheDir}trainer`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

// MIDI 번호로 직접 wav 파일을 보장한다. 기본 권장 진입점.
export async function ensureSineWavFileForMidi(midi: number, durationMs: number): Promise<string> {
  const key = `sine_midi_${Math.round(midi)}_${Math.round(durationMs)}`;
  const cached = getMemo(key);
  if (cached) return cached;

  const dir = await ensureCacheDir();
  const uri = `${dir}/${key}.wav`;
  // MIDI → Hz 변환은 buildSineWavBuffer 내부에서 정확한 평균율로 합성해야 하므로
  // 여기서 한 번만 수행한다.
  const frequencyHz = A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
  await buildAndWriteFile(uri, frequencyHz, durationMs);
  rememberMemo(key, uri);
  return uri;
}

// 주파수 기반 호환 진입점. 내부적으로 가장 가까운 MIDI로 양자화해 캐시 일관성을 유지한다.
export async function ensureSineWavFile(frequencyHz: number, durationMs: number): Promise<string> {
  return ensureSineWavFileForMidi(nearestMidi(frequencyHz), durationMs);
}
