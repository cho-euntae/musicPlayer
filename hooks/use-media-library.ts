import { Track } from "@/store/player-store";
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

interface UseMediaLibraryResult {
  tracks: Track[];
  isLoading: boolean;
  error: string | null;
  permissionStatus: MediaLibrary.PermissionStatus | null;
  requestPermission: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useMediaLibrary(): UseMediaLibraryResult {
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

      const formattedTracks: Track[] = filteredAssets.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
        title: asset.filename.replace(/\.[^/.]+$/, ""),
        duration: asset.duration * 1000,
        album: asset.albumId,
      }));

      setTracks(formattedTracks);
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
  }, []);

  return {
    tracks,
    isLoading,
    error,
    permissionStatus,
    requestPermission,
    refresh: loadTracks,
  };
}
