import { Redirect, usePathname } from 'expo-router';

/**
 * Catch-all for unmatched routes.
 *
 * 가장 흔한 케이스: react-native-track-player가 알림 본문을 탭했을 때
 * 기본 deep link 'musicplayer://notification.click'으로 진입하는데,
 * expo-router에 해당 라우트가 없어서 'Unmatched Route'가 뜬다.
 * 이 경우 풀스크린 플레이어로 리다이렉트한다.
 *
 * 그 외 진짜로 잘못된 URL로 들어온 경우엔 홈 탭으로 보낸다.
 */
export default function NotFoundScreen() {
  const pathname = usePathname();

  if (pathname.includes('notification')) {
    return <Redirect href="/player" />;
  }

  return <Redirect href="/" />;
}
