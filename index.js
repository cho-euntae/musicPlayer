// 헤드리스 알림 액션(일시정지/다음 곡 등)에서도 동작하도록
// React 컴포넌트 트리가 마운트되기 전에 playback service를 등록한다.
import './services/register-track-player';

// expo-router 부팅 (반드시 service 등록 이후)
import 'expo-router/entry';
