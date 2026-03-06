import { create } from 'zustand';

export interface Track {
  id: string;
  uri: string;
  title: string;
  artist?: string;
  album?: string;
  duration: number; // milliseconds
  artwork?: string;
}

interface PlayerState {
  // 현재 재생 목록
  queue: Track[];
  currentIndex: number;

  // 재생 상태
  isPlaying: boolean;
  position: number;   // milliseconds
  duration: number;   // milliseconds

  // 반복/셔플
  isShuffled: boolean;
  repeatMode: 'off' | 'all' | 'one';

  // 액션
  setQueue: (tracks: Track[], startIndex?: number) => void;
  setCurrentIndex: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  playNext: () => void;
  playPrev: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  position: 0,
  duration: 0,
  isShuffled: false,
  repeatMode: 'off',

  setQueue: (tracks, startIndex = 0) =>
    set({ queue: tracks, currentIndex: startIndex, position: 0 }),

  setCurrentIndex: (index) => set({ currentIndex: index, position: 0 }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setPosition: (position) => set({ position }),

  setDuration: (duration) => set({ duration }),

  toggleShuffle: () => set((s) => ({ isShuffled: !s.isShuffled })),

  toggleRepeat: () =>
    set((s) => ({
      repeatMode:
        s.repeatMode === 'off' ? 'all' : s.repeatMode === 'all' ? 'one' : 'off',
    })),

  playNext: () => {
    const { queue, currentIndex, isShuffled, repeatMode } = get();
    if (queue.length === 0) return;

    let nextIndex: number;
    if (isShuffled) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (currentIndex < queue.length - 1) {
      nextIndex = currentIndex + 1;
    } else if (repeatMode === 'all') {
      nextIndex = 0;
    } else {
      return;
    }
    set({ currentIndex: nextIndex, position: 0 });
  },

  playPrev: () => {
    const { queue, currentIndex, position } = get();
    if (queue.length === 0) return;

    // 3초 이상 재생됐으면 처음부터, 아니면 이전 곡
    if (position > 3000) {
      set({ position: 0 });
    } else {
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
      set({ currentIndex: prevIndex, position: 0 });
    }
  },
}));

// 편의 셀렉터
export const useCurrentTrack = () =>
  usePlayerStore((s) => s.queue[s.currentIndex] ?? null);
