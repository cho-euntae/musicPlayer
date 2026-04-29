import { useColorScheme } from 'react-native';
import { usePlayerStore } from '@/store/player-store';

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  bgElevated: string;
  bgPressed: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentBg: string;
  accentText: string;
  switchTrackOff: string;
  switchTrackOn: string;
  switchThumbOff: string;
  switchThumbOn: string;
  sectionLabel: string;
}

export const darkColors: ThemeColors = {
  bg: '#0f1110',
  bgElevated: '#171a18',
  bgPressed: '#1a2a1a',
  border: '#232825',
  text: '#ffffff',
  textSecondary: '#cfd6d2',
  textMuted: '#7a857f',
  accent: '#1DB954',
  accentBg: '#d7ffe2',
  accentText: '#041107',
  switchTrackOff: '#2a2a2a',
  switchTrackOn: '#1f4730',
  switchThumbOff: '#888888',
  switchThumbOn: '#1DB954',
  sectionLabel: '#5d8f6d',
};

export const lightColors: ThemeColors = {
  bg: '#f5f7f5',
  bgElevated: '#ffffff',
  bgPressed: '#e8f5ec',
  border: '#e3e8e4',
  text: '#0a0e0b',
  textSecondary: '#3d4a40',
  textMuted: '#6f7d72',
  accent: '#1DB954',
  accentBg: '#d7ffe2',
  accentText: '#041107',
  switchTrackOff: '#dadcdb',
  switchTrackOn: '#a8e3ba',
  switchThumbOff: '#ffffff',
  switchThumbOn: '#1DB954',
  sectionLabel: '#3d8654',
};

export interface ThemeResult {
  scheme: ColorScheme;
  colors: ThemeColors;
  isSystem: boolean;
}

// 사용자가 선택한 themeMode와 디바이스 설정을 함께 고려해
// 실제 적용할 colorScheme과 색상 토큰을 반환한다.
//
// themeMode === 'system' 일 때:
//   - 디바이스의 다크/라이트 설정에 자동으로 따라간다.
//   - useColorScheme()이 null이면 안전 fallback으로 dark.
// themeMode === 'dark' | 'light' 일 때:
//   - 강제 적용.
export function useTheme(): ThemeResult {
  const themeMode = usePlayerStore((s) => s.themeMode);
  const systemScheme = useColorScheme();

  let scheme: ColorScheme;
  if (themeMode === 'system') {
    scheme = systemScheme === 'light' ? 'light' : 'dark';
  } else {
    scheme = themeMode;
  }

  return {
    scheme,
    colors: scheme === 'light' ? lightColors : darkColors,
    isSystem: themeMode === 'system',
  };
}
