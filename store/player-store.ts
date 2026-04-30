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
  filename?: string;
  creationTime?: number;
  modificationTime?: number;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
}

export type LibrarySortMode = 'name' | 'recent' | 'playCount';
export type ThemeMode = 'system' | 'dark' | 'light';

export const RECENTLY_PLAYED_LIMIT_OPTIONS = [20, 50, 100, 200] as const;
export type RecentlyPlayedLimit = (typeof RECENTLY_PLAYED_LIMIT_OPTIONS)[number];

interface PlayerState {
  // 전체 라이브러리
  libraryTracks: Track[];

  // 라이브러리 정렬 모드
  librarySortMode: LibrarySortMode;

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

  // 재생 횟수
  trackPlayCounts: Record<string, number>;

  // 커스텀 플레이리스트
  playlists: Playlist[];

  // 마지막 재생 상태 (앱 재시작 복원용)
  lastQueue: Track[];
  lastTrackIndex: number;
  lastPosition: number;
  pendingSeekPosition: number | null;

  // 재생 속도 (영속화)
  playbackRate: number;

  // 슬립 타이머 만료 시각 (epoch ms). null이면 비활성. 앱 재시작 시 초기화.
  sleepTimerEndAt: number | null;

  // A-B 구간 반복 (세션 단위, 곡 변경 시 자동 해제, 영속화 X)
  loopStart: number | null; // ms
  loopEnd: number | null;   // ms

  // 설정 (영속화)
  hideCallRecordings: boolean;
  recentlyPlayedLimit: RecentlyPlayedLimit;
  themeMode: ThemeMode;
  // 배터리 절약 모드: BlurView, LinearGradient, image-colors 추출을 모두
  // 비활성화하여 GPU/CPU 부담을 줄인다.
  batterySaverEnabled: boolean;

  // 재생 액션
  setLibraryTracks: (tracks: Track[]) => void;
  setLibrarySortMode: (mode: LibrarySortMode) => void;
  reconcileLibraryTracks: (tracks: Track[], aliases: Record<string, string>) => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  restoreQueue: (tracks: Track[], startIndex: number, positionMs: number) => void;
  setCurrentIndex: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleRepeatOne: () => void;
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
  incrementTrackPlayCount: (trackId: string) => void;

  // 마지막 재생 상태 저장
  savePlaybackState: (positionMs: number) => void;
  clearPendingSeekPosition: () => void;

  // 재생 속도 / 슬립 타이머
  setPlaybackRate: (rate: number) => void;
  setSleepTimerMinutes: (minutes: number | null) => void;

  // A-B 구간 반복
  setLoopStart: (positionMs: number | null) => void;
  setLoopEnd: (positionMs: number | null) => void;
  clearLoop: () => void;

  // 설정 액션
  setHideCallRecordings: (hide: boolean) => void;
  setRecentlyPlayedLimit: (limit: RecentlyPlayedLimit) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setBatterySaverEnabled: (enabled: boolean) => void;

  // 플레이리스트 액션
  createPlaylist: (name: string) => string;
  savePlaylistFromTracks: (name: string, tracks: Track[]) => string;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addTrackToPlaylist: (playlistId: string, track: Track) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  moveTrackInPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      libraryTracks: [],
      librarySortMode: 'name',
      queue: [],
      currentIndex: 0,
      isPlaying: false,
      position: 0,
      duration: 0,
      isShuffled: false,
      repeatMode: 'off',
      favorites: [],
      recentlyPlayed: [],
      trackPlayCounts: {},
      playlists: [],
      lastQueue: [],
      lastTrackIndex: 0,
      lastPosition: 0,
      pendingSeekPosition: null,
      playbackRate: 1,
      sleepTimerEndAt: null,
      loopStart: null,
      loopEnd: null,
      hideCallRecordings: true,
      recentlyPlayedLimit: 50,
      themeMode: 'system',
      batterySaverEnabled: false,

      setLibraryTracks: (tracks) => set({ libraryTracks: tracks }),

      setLibrarySortMode: (mode) => set({ librarySortMode: mode }),

      reconcileLibraryTracks: (tracks, aliases) =>
        set((s) => {
          const trackById = new Map(tracks.map((track) => [track.id, track]));
          const remapId = (id: string) => aliases[id] ?? id;
          const dedupeIds = (ids: string[]) => Array.from(new Set(ids));
          const reconcileTrack = (track: Track) => trackById.get(remapId(track.id)) ?? track;

          const nextFavorites = dedupeIds(
            s.favorites
              .map(remapId)
              .filter((trackId) => trackById.has(trackId))
          );

          const nextRecentlyPlayed = dedupeIds(
            s.recentlyPlayed
              .map(remapId)
              .filter((trackId) => trackById.has(trackId))
          ).slice(0, 50);

          const nextQueue = s.queue.map(reconcileTrack);
          const nextLastQueue = s.lastQueue.map(reconcileTrack);

          return {
            libraryTracks: tracks,
            favorites: nextFavorites,
            recentlyPlayed: nextRecentlyPlayed,
            playlists: s.playlists.map((playlist) => ({
              ...playlist,
              tracks: playlist.tracks.map(reconcileTrack),
            })),
            queue: nextQueue,
            currentIndex: nextQueue.length === 0 ? 0 : Math.min(s.currentIndex, nextQueue.length - 1),
            lastQueue: nextLastQueue,
            lastTrackIndex:
              nextLastQueue.length === 0 ? 0 : Math.min(s.lastTrackIndex, nextLastQueue.length - 1),
          };
        }),

      setQueue: (tracks, startIndex = 0) =>
        set({
          queue: tracks,
          currentIndex: startIndex,
          position: 0,
          lastQueue: tracks,
          lastTrackIndex: startIndex,
          lastPosition: 0,
          pendingSeekPosition: 0,
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

      toggleRepeatOne: () =>
        set((s) => ({
          repeatMode: s.repeatMode === 'one' ? 'off' : 'one',
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

      // 항상 이전 트랙으로 이동한다.
      // "5초 이내에 누르면 이전 곡 / 그 이후에는 처음부터" 로직은
      // TrackPlayer의 실시간 position을 읽을 수 있는 audio-player-context에서 처리한다.
      playPrev: () => {
        const { queue, currentIndex } = get();
        if (queue.length === 0) return;
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
        set({
          currentIndex: prevIndex,
          position: 0,
          lastTrackIndex: prevIndex,
          lastPosition: 0,
        });
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
          return {
            recentlyPlayed: [trackId, ...filtered].slice(0, s.recentlyPlayedLimit),
          };
        }),

      incrementTrackPlayCount: (trackId) =>
        set((s) => ({
          trackPlayCounts: {
            ...s.trackPlayCounts,
            [trackId]: (s.trackPlayCounts[trackId] ?? 0) + 1,
          },
        })),

      savePlaybackState: (positionMs) =>
        set((s) => ({ lastPosition: positionMs, lastTrackIndex: s.currentIndex })),

      clearPendingSeekPosition: () => set({ pendingSeekPosition: null }),

      setPlaybackRate: (rate) => set({ playbackRate: rate }),

      setSleepTimerMinutes: (minutes) =>
        set({
          sleepTimerEndAt:
            minutes === null || minutes <= 0 ? null : Date.now() + minutes * 60_000,
        }),

      setLoopStart: (positionMs) =>
        set((s) => {
          if (positionMs === null) {
            // A를 해제하면 B도 의미가 없으므로 같이 해제.
            return { loopStart: null, loopEnd: null };
          }
          // B가 이미 설정돼 있고 새로운 A가 B 이후라면 B를 해제.
          const nextLoopEnd =
            s.loopEnd !== null && positionMs >= s.loopEnd ? null : s.loopEnd;
          return { loopStart: positionMs, loopEnd: nextLoopEnd };
        }),

      setLoopEnd: (positionMs) =>
        set((s) => {
          if (positionMs === null) {
            return { loopEnd: null };
          }
          // A가 없으면 무시 (UI에서도 막지만 안전장치).
          if (s.loopStart === null) return s;
          // B가 A보다 이전이면 스왑.
          if (positionMs < s.loopStart) {
            return { loopStart: positionMs, loopEnd: s.loopStart };
          }
          return { loopEnd: positionMs };
        }),

      clearLoop: () => set({ loopStart: null, loopEnd: null }),

      setHideCallRecordings: (hide) =>
        set((s) => {
          if (s.hideCallRecordings === hide) return s;
          return { hideCallRecordings: hide };
        }),

      setRecentlyPlayedLimit: (limit) =>
        set((s) => ({
          recentlyPlayedLimit: limit,
          // 새 한도가 기존 길이보다 작으면 즉시 잘라낸다.
          recentlyPlayed: s.recentlyPlayed.slice(0, limit),
        })),

      setThemeMode: (mode) => set({ themeMode: mode }),

      setBatterySaverEnabled: (enabled) => set({ batterySaverEnabled: enabled }),

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

      savePlaylistFromTracks: (name, tracks) => {
        const id = `playlist_${Date.now()}`;
        set((s) => ({
          playlists: [
            ...s.playlists,
            { id, name, tracks: [...tracks], createdAt: Date.now() },
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

      moveTrackInPlaylist: (playlistId, fromIndex, toIndex) =>
        set((s) => ({
          playlists: s.playlists.map((playlist) => {
            if (playlist.id !== playlistId) {
              return playlist;
            }

            if (
              fromIndex === toIndex ||
              fromIndex < 0 ||
              toIndex < 0 ||
              fromIndex >= playlist.tracks.length ||
              toIndex >= playlist.tracks.length
            ) {
              return playlist;
            }

            const nextTracks = [...playlist.tracks];
            const [movedTrack] = nextTracks.splice(fromIndex, 1);
            nextTracks.splice(toIndex, 0, movedTrack);

            return {
              ...playlist,
              tracks: nextTracks,
            };
          }),
        })),
    }),
    {
      name: 'music-player-storage',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      // 재생 상태(position, isPlaying)는 저장 불필요
      partialize: (s) => ({
        libraryTracks: s.libraryTracks,
        librarySortMode: s.librarySortMode,
        isShuffled: s.isShuffled,
        repeatMode: s.repeatMode,
        favorites: s.favorites,
        recentlyPlayed: s.recentlyPlayed,
        trackPlayCounts: s.trackPlayCounts,
        playlists: s.playlists,
        lastQueue: s.lastQueue,
        lastTrackIndex: s.lastTrackIndex,
        lastPosition: s.lastPosition,
        playbackRate: s.playbackRate,
        hideCallRecordings: s.hideCallRecordings,
        recentlyPlayedLimit: s.recentlyPlayedLimit,
        themeMode: s.themeMode,
        batterySaverEnabled: s.batterySaverEnabled,
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
