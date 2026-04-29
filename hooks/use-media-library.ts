import { Track, usePlayerStore } from "@/store/player-store";
import * as MediaLibrary from "expo-media-library";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

// 갤럭시 통화 녹음 폴더 패턴
const CALL_RECORDING_PATTERNS = [
  "/Recordings/TPhoneCallRecords", // 갤럭시 통화 녹음 폴더 패턴
  "/Recordings/Call",
  "/recordings/call",
  "/통화 녹음",
  "/Call recordings",
  "/call_recordings",
  "/PhoneRecord",
  "/phonerecord",
  "/CallRecord",
  "/callrecord",
];

function isCallRecording(uri: string): boolean {
  const lower = uri.toLowerCase();
  return CALL_RECORDING_PATTERNS.some((pattern) =>
    lower.includes(pattern.toLowerCase()),
  );
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "");
}

function parseTrackMetadata(filename: string) {
  const baseName = stripExtension(filename).trim();
  const separators = [" - ", " – ", " — "];

  for (const separator of separators) {
    const [artistPart, titlePart, ...rest] = baseName.split(separator);
    if (!artistPart || !titlePart || rest.length > 0) continue;

    const artist = artistPart.trim();
    const title = titlePart.trim();
    if (!artist || !title) continue;

    return { title, artist };
  }

  return {
    title: baseName,
    artist: undefined,
  };
}

function normalizeText(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getTrackDedupKey(track: Track): string {
  const normalizedTitle = normalizeText(track.title);
  const normalizedArtist = normalizeText(track.artist);
  const roundedDurationMs = Math.round(track.duration / 1000) * 1000;

  return `${normalizedTitle}::${normalizedArtist}::${roundedDurationMs}`;
}

function getParentDirectory(uri: string): string {
  const normalizedUri = uri.toLowerCase();
  const lastSlashIndex = normalizedUri.lastIndexOf("/");
  return lastSlashIndex === -1 ? normalizedUri : normalizedUri.slice(0, lastSlashIndex);
}

function getRoundedSeconds(timestampMs?: number): number {
  if (!timestampMs) return 0;
  return Math.round(timestampMs / 1000);
}

function getTrackMatchKeys(track: Track) {
  const roundedDurationMs = Math.round(track.duration / 1000) * 1000;
  const normalizedTitle = normalizeText(track.title);
  const normalizedArtist = normalizeText(track.artist);

  return {
    uri: track.uri.toLowerCase(),
    metadata: `${normalizedTitle}::${normalizedArtist}::${roundedDurationMs}`,
    creationAndDuration: `${getRoundedSeconds(track.creationTime)}::${roundedDurationMs}`,
    directoryCreationAndDuration: `${getParentDirectory(track.uri)}::${getRoundedSeconds(track.creationTime)}::${roundedDurationMs}`,
  };
}

function indexTracksByKey(
  tracks: Track[],
  selectKey: (track: Track) => string,
): Map<string, Track[]> {
  const indexed = new Map<string, Track[]>();

  tracks.forEach((track) => {
    const key = selectKey(track);
    const existing = indexed.get(key);

    if (existing) {
      existing.push(track);
    } else {
      indexed.set(key, [track]);
    }
  });

  return indexed;
}

function buildTrackAliases(previousTracks: Track[], nextTracks: Track[]): Record<string, string> {
  const aliases: Record<string, string> = {};
  const nextTrackById = new Map(nextTracks.map((track) => [track.id, track]));
  const claimedIds = new Set<string>();
  const remainingPreviousTracks: Track[] = [];

  previousTracks.forEach((track) => {
    if (nextTrackById.has(track.id)) {
      aliases[track.id] = track.id;
      claimedIds.add(track.id);
      return;
    }

    remainingPreviousTracks.push(track);
  });

  const nextTracksByUri = indexTracksByKey(nextTracks, (track) => getTrackMatchKeys(track).uri);
  const nextTracksByDirectoryCreationAndDuration = indexTracksByKey(
    nextTracks,
    (track) => getTrackMatchKeys(track).directoryCreationAndDuration,
  );
  const nextTracksByCreationAndDuration = indexTracksByKey(
    nextTracks,
    (track) => getTrackMatchKeys(track).creationAndDuration,
  );
  const nextTracksByMetadata = indexTracksByKey(
    nextTracks,
    (track) => getTrackMatchKeys(track).metadata,
  );

  const claimTrack = (candidates: Track[] | undefined) => {
    const availableTrack = candidates?.find((track) => !claimedIds.has(track.id));
    if (!availableTrack) return null;

    claimedIds.add(availableTrack.id);
    return availableTrack;
  };

  const matchers = [
    (track: Track) => claimTrack(nextTracksByUri.get(getTrackMatchKeys(track).uri)),
    (track: Track) =>
      claimTrack(
        nextTracksByDirectoryCreationAndDuration.get(
          getTrackMatchKeys(track).directoryCreationAndDuration,
        ),
      ),
    (track: Track) =>
      claimTrack(
        nextTracksByCreationAndDuration.get(getTrackMatchKeys(track).creationAndDuration),
      ),
    (track: Track) => claimTrack(nextTracksByMetadata.get(getTrackMatchKeys(track).metadata)),
  ];

  remainingPreviousTracks.forEach((track) => {
    for (const matchTrack of matchers) {
      const matchedTrack = matchTrack(track);
      if (!matchedTrack) continue;

      aliases[track.id] = matchedTrack.id;
      break;
    }
  });

  return aliases;
}

// 앱 단위로 공유되는 스캔 상태 — 여러 컴포넌트에서 useMediaLibrary를 호출해도
// 전체 오디오 스캔은 최초 1회만 실행된다.
type ScanListener = () => void;

const scanState = {
  isLoading: false,
  error: null as string | null,
  permissionStatus: null as MediaLibrary.PermissionStatus | null,
  hasScanned: false,
  inflightScan: null as Promise<void> | null,
  listeners: new Set<ScanListener>(),
};

function notifyScanListeners() {
  scanState.listeners.forEach((listener) => listener());
}

async function runLibraryScan(): Promise<void> {
  if (scanState.inflightScan) {
    return scanState.inflightScan;
  }

  scanState.isLoading = true;
  scanState.error = null;
  notifyScanListeners();

  const scanPromise = (async () => {
    try {
      let allAssets: MediaLibrary.Asset[] = [];
      let after: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.audio,
          first: 100,
          after,
          sortBy: MediaLibrary.SortBy.default,
        });
        allAssets = [...allAssets, ...page.assets];
        after = page.endCursor;
        hasMore = page.hasNextPage;
      }

      const hideCallRecordings = usePlayerStore.getState().hideCallRecordings;
      const filteredAssets = hideCallRecordings
        ? allAssets.filter((asset) => !isCallRecording(asset.uri))
        : allAssets;

      const formattedTracks: Track[] = filteredAssets.map((asset) => {
        const { title, artist } = parseTrackMetadata(asset.filename);

        // Android는 albumId가 있으면 미디어스토어가 노출하는 표준 albumart
        // content URI를 통해 임베디드/앨범 단위 아트워크에 접근할 수 있다.
        // 실제로 아트워크가 없는 경우 Image.onError에서 fallback을 그리도록 처리.
        const artwork =
          Platform.OS === "android" && asset.albumId
            ? `content://media/external/audio/albumart/${asset.albumId}`
            : undefined;

        return {
          id: asset.id,
          uri: asset.uri,
          title,
          artist,
          duration: asset.duration * 1000,
          artwork,
          album: asset.albumId,
          filename: asset.filename,
          creationTime: asset.creationTime,
          modificationTime: asset.modificationTime,
        };
      });

      const dedupedTracks = Array.from(
        new Map(
          formattedTracks.map((track) => [getTrackDedupKey(track), track]),
        ).values(),
      );

      const previousState = usePlayerStore.getState();
      const previousTracks = [
        ...previousState.libraryTracks,
        ...previousState.queue,
        ...previousState.lastQueue,
        ...previousState.playlists.flatMap((playlist) => playlist.tracks),
      ];
      const aliases = buildTrackAliases(previousTracks, dedupedTracks);

      previousState.reconcileLibraryTracks(dedupedTracks, aliases);
      scanState.hasScanned = true;
    } catch (e) {
      console.error("[useMediaLibrary] loadTracks failed", e);
      scanState.error = "음악 목록을 불러오는데 실패했습니다.";
    } finally {
      scanState.isLoading = false;
      scanState.inflightScan = null;
      notifyScanListeners();
    }
  })();

  scanState.inflightScan = scanPromise;
  return scanPromise;
}

async function ensureInitialScan(): Promise<void> {
  try {
    const { status } = await MediaLibrary.getPermissionsAsync(false, ["audio"]);
    scanState.permissionStatus = status;
    notifyScanListeners();
    if (status === "granted" && !scanState.hasScanned) {
      await runLibraryScan();
    }
  } catch (e) {
    console.error("[useMediaLibrary] initial permission check failed", e);
    scanState.error = "미디어 라이브러리 접근에 실패했습니다.";
    notifyScanListeners();
  }
}

interface UseMediaLibraryResult {
  tracks: Track[];
  isLoading: boolean;
  error: string | null;
  permissionStatus: MediaLibrary.PermissionStatus | null;
  requestPermission: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useMediaLibrary(): UseMediaLibraryResult {
  const libraryTracks = usePlayerStore((s) => s.libraryTracks);

  // 로컬 state는 scanState 스냅샷을 보관하는 용도
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    scanState.listeners.add(listener);
    return () => {
      scanState.listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    void ensureInitialScan();
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(false, [
        "audio",
      ]);
      scanState.permissionStatus = status;
      notifyScanListeners();
      if (status === "granted") {
        await runLibraryScan();
      }
    } catch (e) {
      console.error("[useMediaLibrary] requestPermission failed", e);
      scanState.error = "권한 요청에 실패했습니다.";
      notifyScanListeners();
    }
  }, []);

  const refresh = useCallback(async () => {
    await runLibraryScan();
  }, []);

  return {
    tracks: libraryTracks,
    isLoading: scanState.isLoading,
    error: scanState.error,
    permissionStatus: scanState.permissionStatus,
    requestPermission,
    refresh,
  };
}
