import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Track {
  id: string;
  uri: string;
  title: string;
  artist?: string;
  album?: string;
  duration: number; // milliseconds
  artwork?: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
}

interface PlayerState {
  // 전체 라이브러리
  libraryTracks: Track[];

  // 재생 큐
  queue: Track[];
  currentIndex: number;

  // 재생 상태 (persist 제외)
  isPlaying: boolean;
  position: number;
  duration: number;

  // 반복/셔플
  isShuffled: boolean;
  repeatMode: 'off' | 'all' | 'one';

  // 즐겨찾기 (track id 목록)
  favorites: string[];

  // 최근 재생 (track id 목록, 최대 50개)
  recentlyPlayed: string[];

  // 커스텀 플레이리스트
  playlists: Playlist[];

  // 마지막 재생 상태 (앱 재시작 복원용)
  lastQueue: Track[];
  lastTrackIndex: number;
  lastPosition: number;
  pendingSeekPosition: number | null;

  // 재생 액션
  setLibraryTracks: (tracks: Track[]) => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  restoreQueue: (tracks: Track[], startIndex: number, positionMs: number) => void;
  setCurrentIndex: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  playNext: () => void;
  playPrev: () => void;
  addTrackToNextInQueue: (track: Track) => void;
  clearQueue: () => void;
  moveTrackInQueue: (fromIndex: number, toIndex: number) => void;
  removeTrackFromQueue: (trackId: string) => void;

  // 즐겨찾기 액션
  toggleFavorite: (trackId: string) => void;

  // 최근 재생 액션
  addToRecentlyPlayed: (trackId: string) => void;

  // 마지막 재생 상태 저장
  savePlaybackState: (positionMs: number) => void;
  clearPendingSeekPosition: () => void;

  // 플레이리스트 액션
  createPlaylist: (name: string) => string;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addTrackToPlaylist: (playlistId: string, track: Track) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      libraryTracks: [],
      queue: [],
      currentIndex: 0,
      isPlaying: false,
      position: 0,
      duration: 0,
      isShuffled: false,
      repeatMode: 'off',
      favorites: [],
      recentlyPlayed: [],
      playlists: [],
      lastQueue: [],
      lastTrackIndex: 0,
      lastPosition: 0,
      pendingSeekPosition: null,

      setLibraryTracks: (tracks) => set({ libraryTracks: tracks }),

      setQueue: (tracks, startIndex = 0) =>
        set({
          queue: tracks,
          currentIndex: startIndex,
          position: 0,
          lastQueue: tracks,
          lastTrackIndex: startIndex,
          lastPosition: 0,
          pendingSeekPosition: null,
        }),

      restoreQueue: (tracks, startIndex, positionMs) =>
        set({
          queue: tracks,
          currentIndex: startIndex,
          position: positionMs,
          lastQueue: tracks,
          lastTrackIndex: startIndex,
          lastPosition: positionMs,
          pendingSeekPosition: positionMs,
        }),

      setCurrentIndex: (index) =>
        set({ currentIndex: index, position: 0, lastTrackIndex: index, lastPosition: 0 }),

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
        set({ currentIndex: nextIndex, position: 0, isPlaying: true, lastTrackIndex: nextIndex, lastPosition: 0 });
      },

      playPrev: () => {
        const { queue, currentIndex, position } = get();
        if (queue.length === 0) return;
        if (position > 3000) {
          set({ position: 0, lastPosition: 0 });
        } else {
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
          set({ currentIndex: prevIndex, position: 0, lastTrackIndex: prevIndex, lastPosition: 0 });
        }
      },

      addTrackToNextInQueue: (track) =>
        set((s) => {
          if (s.queue.length === 0) {
            return {
              queue: [track],
              currentIndex: 0,
              isPlaying: true,
              position: 0,
              lastQueue: [track],
              lastTrackIndex: 0,
              lastPosition: 0,
              pendingSeekPosition: null,
            };
          }

          const insertIndex = Math.min(s.currentIndex + 1, s.queue.length);
          const nextQueue = [...s.queue];
          nextQueue.splice(insertIndex, 0, track);

          return {
            queue: nextQueue,
            lastQueue: nextQueue,
            lastTrackIndex: s.currentIndex,
          };
        }),

      clearQueue: () =>
        set({
          queue: [],
          currentIndex: 0,
          isPlaying: false,
          position: 0,
          duration: 0,
          lastQueue: [],
          lastTrackIndex: 0,
          lastPosition: 0,
          pendingSeekPosition: null,
        }),

      moveTrackInQueue: (fromIndex, toIndex) =>
        set((s) => {
          if (
            fromIndex === toIndex ||
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= s.queue.length ||
            toIndex >= s.queue.length
          ) {
            return s;
          }

          const nextQueue = [...s.queue];
          const [movedTrack] = nextQueue.splice(fromIndex, 1);
          nextQueue.splice(toIndex, 0, movedTrack);

          let nextCurrentIndex = s.currentIndex;
          if (s.currentIndex === fromIndex) {
            nextCurrentIndex = toIndex;
          } else if (fromIndex < s.currentIndex && toIndex >= s.currentIndex) {
            nextCurrentIndex = s.currentIndex - 1;
          } else if (fromIndex > s.currentIndex && toIndex <= s.currentIndex) {
            nextCurrentIndex = s.currentIndex + 1;
          }

          return {
            queue: nextQueue,
            currentIndex: nextCurrentIndex,
            lastQueue: nextQueue,
            lastTrackIndex: nextCurrentIndex,
          };
        }),

      removeTrackFromQueue: (trackId) =>
        set((s) => {
          const removeIndex = s.queue.findIndex((track) => track.id === trackId);
          if (removeIndex === -1) return s;

          const nextQueue = s.queue.filter((track) => track.id !== trackId);

          if (nextQueue.length === 0) {
            return {
              queue: [],
              currentIndex: 0,
              isPlaying: false,
              position: 0,
              duration: 0,
              lastQueue: [],
              lastTrackIndex: 0,
              lastPosition: 0,
              pendingSeekPosition: null,
            };
          }

          let nextIndex = s.currentIndex;
          let nextPosition = s.position;

          if (removeIndex < s.currentIndex) {
            nextIndex = s.currentIndex - 1;
          } else if (removeIndex === s.currentIndex) {
            nextIndex = Math.min(s.currentIndex, nextQueue.length - 1);
            nextPosition = 0;
          }

          return {
            queue: nextQueue,
            currentIndex: nextIndex,
            position: nextPosition,
            lastQueue: nextQueue,
            lastTrackIndex: nextIndex,
            lastPosition: nextPosition,
            pendingSeekPosition: null,
          };
        }),

      toggleFavorite: (trackId) =>
        set((s) => ({
          favorites: s.favorites.includes(trackId)
            ? s.favorites.filter((id) => id !== trackId)
            : [...s.favorites, trackId],
        })),

      addToRecentlyPlayed: (trackId) =>
        set((s) => {
          const filtered = s.recentlyPlayed.filter((id) => id !== trackId);
          return { recentlyPlayed: [trackId, ...filtered].slice(0, 50) };
        }),

      savePlaybackState: (positionMs) =>
        set((s) => ({ lastPosition: positionMs, lastTrackIndex: s.currentIndex })),

      clearPendingSeekPosition: () => set({ pendingSeekPosition: null }),

      createPlaylist: (name) => {
        const id = `playlist_${Date.now()}`;
        set((s) => ({
          playlists: [
            ...s.playlists,
            { id, name, tracks: [], createdAt: Date.now() },
          ],
        }));
        return id;
      },

      deletePlaylist: (id) =>
        set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),

      renamePlaylist: (id, name) =>
        set((s) => ({
          playlists: s.playlists.map((p) => (p.id === id ? { ...p, name } : p)),
        })),

      addTrackToPlaylist: (playlistId, track) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId && !p.tracks.some((t) => t.id === track.id)
              ? { ...p, tracks: [...p.tracks, track] }
              : p
          ),
        })),

      removeTrackFromPlaylist: (playlistId, trackId) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) }
              : p
          ),
        })),
    }),
    {
      name: 'music-player-storage',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      // 재생 상태(position, isPlaying)는 저장 불필요
      partialize: (s) => ({
        isShuffled: s.isShuffled,
        repeatMode: s.repeatMode,
        favorites: s.favorites,
        recentlyPlayed: s.recentlyPlayed,
        playlists: s.playlists,
        lastQueue: s.lastQueue,
        lastTrackIndex: s.lastTrackIndex,
        lastPosition: s.lastPosition,
      }),
      // 구버전 데이터 마이그레이션 (trackIds → tracks)
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          persistedState.playlists = (persistedState.playlists ?? []).map(
            (p: any) => ({
              ...p,
              tracks: p.tracks ?? [],
            })
          );
        }
        return persistedState;
      },
    }
  )
);

export const useCurrentTrack = () =>
  usePlayerStore((s) => s.queue[s.currentIndex] ?? null);
