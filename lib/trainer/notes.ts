// 12음 평균율 기준 음 ↔ 주파수 변환 유틸.
//
// MIDI 번호: A4(69) = 440Hz를 기준으로 반음당 2^(1/12) 비율.
// 보컬 트레이너에서 다루는 범위는 일반적으로 C2(36) ~ C6(84) 사이이며,
// 본 모듈은 그 범위를 가정해 만든 헬퍼들이다.

export const A4_MIDI = 69;
export const A4_FREQ = 440;

export const TRAINER_MIN_MIDI = 36; // C2
export const TRAINER_MAX_MIDI = 84; // C6

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const NOTE_NAMES_KO = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'] as const;

export interface Note {
  midi: number;
  name: string;        // "C4"
  nameKo: string;      // "도4"
  frequency: number;   // Hz
  octave: number;
}

export function midiToFrequency(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

export function frequencyToMidi(frequency: number): number {
  return A4_MIDI + 12 * Math.log2(frequency / A4_FREQ);
}

export function midiToNote(midi: number): Note {
  const idx = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return {
    midi,
    name: `${NOTE_NAMES_SHARP[idx]}${octave}`,
    nameKo: `${NOTE_NAMES_KO[idx]}${octave}`,
    frequency: midiToFrequency(midi),
    octave,
  };
}

// C 메이저 한 옥타브: 도-레-미-파-솔-라-시-도 (8음)
// 향후 다양한 워밍업 패턴(예: 3화음 분산, 5도 도약) 추가 시 같은 형태로 함수 추가.
// 현재 직접 호출처는 없지만 P3 패치에서 사용 예정이라 export 유지.
export function cMajorScale(rootMidi: number): Note[] {
  // 다이아토닉 인터벌(반음 단위): 0,2,4,5,7,9,11,12
  const intervals = [0, 2, 4, 5, 7, 9, 11, 12];
  return intervals.map((semitones) => midiToNote(rootMidi + semitones));
}

// 음이름의 옥타브 숫자를 떼어 음절만 반환 ("도4" → "도", "도#4" → "도#").
// UI에서 옥타브 정보를 빼고 보여주고 싶을 때 정규식 대신 사용.
export function noteNameKoBase(note: Note): string {
  // NOTE_NAMES_KO를 직접 참조하지 않고 nameKo에서 순수한 한글/# 부분만 추출.
  // 옥타브가 한 자리 정수라는 가정에 의존하지 않도록 trailing digits 전부 제거.
  return note.nameKo.replace(/\d+$/, '');
}

// 도-레-미-파-솔-파-미-레-도 (보컬 워밍업의 정석. 9음)
export function vocalizeScaleUpDown(rootMidi: number): Note[] {
  const intervals = [0, 2, 4, 5, 7, 5, 4, 2, 0];
  return intervals.map((semitones) => midiToNote(rootMidi + semitones));
}

// 두 주파수 사이의 음정 차이를 cent(반음의 1/100) 단위로.
// 양수: 측정값이 기준보다 높음. 음수: 낮음.
export function centsBetween(measuredHz: number, targetHz: number): number {
  if (measuredHz <= 0 || targetHz <= 0) return 0;
  return 1200 * Math.log2(measuredHz / targetHz);
}
