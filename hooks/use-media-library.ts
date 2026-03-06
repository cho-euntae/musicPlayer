import { useState, useEffect } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { Track } from '@/store/player-store';

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
    const { status } = await MediaLibrary.requestPermissionsAsync();
    setPermissionStatus(status);
    if (status === 'granted') {
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

      const formattedTracks: Track[] = allAssets.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
        title: asset.filename.replace(/\.[^/.]+$/, ''),
        duration: asset.duration * 1000,
        album: asset.albumId,
      }));

      setTracks(formattedTracks);
    } catch (e) {
      setError('음악 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.getPermissionsAsync();
      setPermissionStatus(status);
      if (status === 'granted') {
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
