import {
  A4_FREQ,
  A4_MIDI,
  TRAINER_MIN_MIDI,
  TRAINER_MAX_MIDI,
  cMajorScale,
  centsBetween,
  frequencyToMidi,
  midiToFrequency,
  midiToNote,
  noteNameKoBase,
  vocalizeScaleUpDown,
} from '../notes';

// 평균율 변환은 수치 정밀도가 있는 도메인이라 절대비교 대신 epsilon으로 비교한다.
const EPS_HZ = 1e-6;
const EPS_CENT = 1e-9;

describe('midiToFrequency / frequencyToMidi', () => {
  it('A4 (MIDI 69)는 정확히 440Hz', () => {
    expect(midiToFrequency(A4_MIDI)).toBeCloseTo(A4_FREQ, 10);
  });

  it('A5 (MIDI 81)는 880Hz', () => {
    expect(midiToFrequency(81)).toBeCloseTo(880, 6);
  });

  it('A3 (MIDI 57)는 220Hz', () => {
    expect(midiToFrequency(57)).toBeCloseTo(220, 6);
  });

  it('C4 (MIDI 60) ≈ 261.6256Hz', () => {
    expect(midiToFrequency(60)).toBeCloseTo(261.6256, 3);
  });

  it('두 함수는 서로의 역함수 (라운드트립)', () => {
    for (let m = 36; m <= 84; m++) {
      const back = frequencyToMidi(midiToFrequency(m));
      expect(Math.abs(back - m)).toBeLessThan(EPS_HZ);
    }
  });
});

describe('midiToNote', () => {
  it('C4(60) → 도4 / C4 / 261.6256Hz / octave 4', () => {
    const n = midiToNote(60);
    expect(n.midi).toBe(60);
    expect(n.name).toBe('C4');
    expect(n.nameKo).toBe('도4');
    expect(n.octave).toBe(4);
    expect(n.frequency).toBeCloseTo(261.6256, 3);
  });

  it('A4(69) → 라4 / A4', () => {
    const n = midiToNote(69);
    expect(n.name).toBe('A4');
    expect(n.nameKo).toBe('라4');
    expect(n.octave).toBe(4);
  });

  it('샤프 음 (D#5 = 75)', () => {
    const n = midiToNote(75);
    expect(n.name).toBe('D#5');
    expect(n.nameKo).toBe('레#5');
  });

  it('C-1 (MIDI 0) 같은 극단 값에서도 octave 계산 일관', () => {
    const n = midiToNote(0);
    expect(n.name).toBe('C-1');
    expect(n.octave).toBe(-1);
  });
});

describe('noteNameKoBase', () => {
  it('"도4" → "도"', () => {
    expect(noteNameKoBase(midiToNote(60))).toBe('도');
  });

  it('"도#4" → "도#" (샤프 보존)', () => {
    expect(noteNameKoBase(midiToNote(61))).toBe('도#');
  });

  it('두 자리 옥타브도 처리 ("도10"은 비현실이지만 \\d+$로 안전)', () => {
    expect(noteNameKoBase({ ...midiToNote(60), nameKo: '도10' })).toBe('도');
  });
});

describe('cMajorScale', () => {
  it('rootMidi(60)에서 8음 (도-레-미-파-솔-라-시-도) 반환', () => {
    const scale = cMajorScale(60);
    expect(scale).toHaveLength(8);
    expect(scale.map((n) => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });
});

describe('vocalizeScaleUpDown', () => {
  it('rootMidi(60)에서 9음 (도-레-미-파-솔-파-미-레-도) 반환', () => {
    const scale = vocalizeScaleUpDown(60);
    expect(scale).toHaveLength(9);
    expect(scale.map((n) => n.midi)).toEqual([60, 62, 64, 65, 67, 65, 64, 62, 60]);
  });

  it('가장 높은 음이 5번째(인덱스 4)에 위치 (= 솔)', () => {
    const scale = vocalizeScaleUpDown(60);
    const peakIdx = scale.reduce(
      (best, n, i) => (n.midi > scale[best].midi ? i : best),
      0,
    );
    expect(peakIdx).toBe(4);
  });
});

describe('centsBetween', () => {
  it('동일 주파수 → 0 cent', () => {
    expect(Math.abs(centsBetween(440, 440))).toBeLessThan(EPS_CENT);
  });

  it('한 옥타브 위 → +1200 cent', () => {
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 6);
  });

  it('한 반음 위 → +100 cent', () => {
    expect(centsBetween(midiToFrequency(70), midiToFrequency(69))).toBeCloseTo(100, 6);
  });

  it('비양수 입력 방어 (0 또는 음수)', () => {
    expect(centsBetween(0, 440)).toBe(0);
    expect(centsBetween(440, 0)).toBe(0);
    expect(centsBetween(-1, 440)).toBe(0);
  });
});

describe('상수', () => {
  it('TRAINER_MIN_MIDI = C2 (36)', () => {
    expect(TRAINER_MIN_MIDI).toBe(36);
    expect(midiToNote(TRAINER_MIN_MIDI).name).toBe('C2');
  });

  it('TRAINER_MAX_MIDI = C6 (84)', () => {
    expect(TRAINER_MAX_MIDI).toBe(84);
    expect(midiToNote(TRAINER_MAX_MIDI).name).toBe('C6');
  });
});
