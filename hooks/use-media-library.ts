import { Track, usePlayerStore } from "@/store/player-store";
import * as MediaLibrary from "expo-media-library";
import { useEffect, useState } from "react";

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

interface UseMediaLibraryResult {
  tracks: Track[];
  isLoading: boolean;
  error: string | null;
  permissionStatus: MediaLibrary.PermissionStatus | null;
  requestPermission: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useMediaLibrary(): UseMediaLibraryResult {
  const reconcileLibraryTracks = usePlayerStore((s) => s.reconcileLibraryTracks);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<MediaLibrary.PermissionStatus | null>(null);

  const requestPermission = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync(false, [
      "audio",
    ]);
    setPermissionStatus(status);
    if (status === "granted") {
      await loadTracks();
    }
  };

  const loadTracks = async () => {
    setIsLoading(true);
    setError(null);
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

      // 디버그: 오디오 파일 경로 출력 (확인 후 제거)
      // console.log(
      //   "[AudioFiles]",
      //   allAssets.slice(0, 20).map((a) => a.uri),
      // );

      const filteredAssets = allAssets.filter(
        (asset) => !isCallRecording(asset.uri),
      );

      const formattedTracks: Track[] = filteredAssets.map((asset) => {
        const { title, artist } = parseTrackMetadata(asset.filename);

        return {
          id: asset.id,
          uri: asset.uri,
          title,
          artist,
          duration: asset.duration * 1000,
          album: asset.albumId,
          filename: asset.filename,
          creationTime: asset.creationTime,
          modificationTime: asset.modificationTime,
        };
      });

      const dedupedTracks = Array.from(
        new Map(formattedTracks.map((track) => [getTrackDedupKey(track), track])).values(),
      );

      const previousState = usePlayerStore.getState();
      const previousTracks = [
        ...previousState.libraryTracks,
        ...previousState.queue,
        ...previousState.lastQueue,
        ...previousState.playlists.flatMap((playlist) => playlist.tracks),
      ];
      const aliases = buildTrackAliases(previousTracks, dedupedTracks);

      setTracks(dedupedTracks);
      reconcileLibraryTracks(dedupedTracks, aliases);
    } catch (e) {
      setError("음악 목록을 불러오는데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.getPermissionsAsync(false, [
        "audio",
      ]);
      setPermissionStatus(status);
      if (status === "granted") {
        await loadTracks();
      }
    })();
  }, [reconcileLibraryTracks]);

  return {
    tracks,
    isLoading,
    error,
    permissionStatus,
    requestPermission,
    refresh: loadTracks,
  };
}
