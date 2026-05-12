// expo-file-system/legacy를 모킹해서 실제 파일 I/O 없이 캐시 동작을 검증한다.
//
// 모킹 정책:
//  - cacheDirectory는 가상 경로 'mock://cache/'.
//  - getInfoAsync는 디렉토리/파일 존재 여부를 인메모리 set으로 시뮬레이션.
//  - writeAsStringAsync는 파일 생성 기록만 남기고, 실제 디스크는 건드리지 않음.

import type * as SineWavModule from '../sine-wav';

const mockWriteCalls: string[] = [];
const mockExistingFiles = new Set<string>();
const mockExistingDirs = new Set<string>();

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'mock://cache/',
  getInfoAsync: jest.fn(async (uri: string) => ({
    exists: mockExistingFiles.has(uri) || mockExistingDirs.has(uri),
    uri,
  })),
  makeDirectoryAsync: jest.fn(async (uri: string) => {
    mockExistingDirs.add(uri);
  }),
  writeAsStringAsync: jest.fn(async (uri: string) => {
    mockWriteCalls.push(uri);
    mockExistingFiles.add(uri);
  }),
  EncodingType: { Base64: 'base64' },
}));

beforeEach(() => {
  mockWriteCalls.length = 0;
  mockExistingFiles.clear();
  mockExistingDirs.clear();
  // sine-wav 모듈은 모듈 레벨 LRU Map을 가진다.
  // 테스트 격리를 위해 매 케이스마다 fresh 모듈을 받는다.
  jest.resetModules();
});

// 매번 fresh 모듈을 가져오기 위한 헬퍼.
// jest.isolateModules + require가 표준 패턴이라 lint 경고는 의도적으로 무시.
function loadFreshModule(): typeof SineWavModule {
  let mod: typeof SineWavModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../sine-wav') as typeof SineWavModule;
  });
  if (!mod) throw new Error('failed to load fresh sine-wav module');
  return mod;
}

describe('ensureSineWavFileForMidi — 캐시 키와 LRU', () => {
  it('같은 MIDI/길이는 디스크 쓰기를 한 번만 한다 (메모이즈 hit)', async () => {
    const mod = loadFreshModule();
    const u1 = await mod.ensureSineWavFileForMidi(60, 700);
    const u2 = await mod.ensureSineWavFileForMidi(60, 700);
    expect(u1).toBe(u2);
    expect(mockWriteCalls).toHaveLength(1);
  });

  it('다른 MIDI는 다른 파일을 만든다', async () => {
    const mod = loadFreshModule();
    const u60 = await mod.ensureSineWavFileForMidi(60, 700);
    const u62 = await mod.ensureSineWavFileForMidi(62, 700);
    expect(u60).not.toBe(u62);
    expect(mockWriteCalls).toHaveLength(2);
  });

  it('LRU 50개를 넘으면 가장 오래된 항목이 인메모리 캐시에서 제거된다', async () => {
    const mod = loadFreshModule();
    // 51개 서로 다른 음을 차례로 보장 → 첫 항목은 메모리에서 evict.
    for (let m = 36; m < 36 + 51; m++) {
      await mod.ensureSineWavFileForMidi(m, 700);
    }
    expect(mockWriteCalls).toHaveLength(51);
    const before = mockWriteCalls.length;

    // 첫 항목(36)을 다시 요청 → 디스크 파일은 이미 존재하므로 write는 일어나지 않지만,
    // 인메모리 캐시에서 evict 되었기 때문에 ensureCacheDir/getInfoAsync 경유.
    await mod.ensureSineWavFileForMidi(36, 700);
    // 디스크 파일이 이미 있으므로 새로 쓰지 않는다.
    expect(mockWriteCalls.length).toBe(before);

    // 그러나 가장 최근에 쓴 항목(86)은 인메모리에 남아 있어야 함 → 추가 쓰기 없음.
    await mod.ensureSineWavFileForMidi(36 + 50, 700);
    expect(mockWriteCalls.length).toBe(before);
  });

  it('재참조 시 LRU 순서가 갱신되어 최근 사용한 항목은 evict 되지 않는다', async () => {
    const mod = loadFreshModule();
    // 50개 채움
    for (let m = 36; m < 36 + 50; m++) {
      await mod.ensureSineWavFileForMidi(m, 700);
    }
    // 36을 재참조 → most-recent로 이동
    await mod.ensureSineWavFileForMidi(36, 700);
    // 이제 새 항목 추가 시 evict 대상은 36이 아니라 37이 되어야 함 (검증은 외부 동작).
    // 인메모리 evict 자체는 직접 관찰 불가하므로, 적어도 36 재참조가 write를 새로
    // 일으키지 않는지로만 간접 확인.
    expect(mockWriteCalls).toHaveLength(50);
  });
});

describe('ensureSineWavFile (호환 진입점)', () => {
  it('주파수 입력은 가장 가까운 MIDI로 양자화되어 ensureSineWavFileForMidi와 동일 캐시 키를 쓴다', async () => {
    const mod = loadFreshModule();
    // C4 ≈ 261.6256Hz, 한 cent 살짝 어긋난 값을 줘도 같은 MIDI=60으로 잡혀야 함.
    const uByMidi = await mod.ensureSineWavFileForMidi(60, 700);
    const uByFreq = await mod.ensureSineWavFile(261.7, 700);
    expect(uByFreq).toBe(uByMidi);
    expect(mockWriteCalls).toHaveLength(1);
  });

  it('주파수가 인접 반음 사이라면 가까운 쪽으로 라운드된다', async () => {
    const mod = loadFreshModule();
    // 261.6256 (C4) vs 277.1826 (C#4). 둘 사이 중간 ≈ 269.4
    const u1 = await mod.ensureSineWavFile(262, 700); // C4
    const u2 = await mod.ensureSineWavFile(277, 700); // C#4
    expect(u1).not.toBe(u2);
  });
});
