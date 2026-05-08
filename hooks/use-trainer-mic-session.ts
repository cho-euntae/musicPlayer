import { useEffect, useRef, useState } from 'react';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
} from 'expo-audio';

// 트레이너에서 마이크를 쓰는 화면들이 공통으로 필요한 사이드이펙트를 묶은 훅.
//
// 책임:
//  1) 마이크 권한 요청 (1회)
//  2) iOS AVAudioSession 카테고리를 playAndRecord 계열로 전환 (allowsRecording: true)
//  3) 화면 이탈 시 녹음 중지 + 모드 원복 (allowsRecording: false)
//
// 분리 이유:
//  - 화면(mic-test, 향후 pitch 인식 화면 등)이 추가되어도 권한/모드 전환 정책이
//    한 곳에서 관리되어야 일관성이 깨지지 않는다.
//  - 화면 컴포넌트는 UI 책임에 집중하고, 세션은 훅이 담당.
export interface TrainerMicSession {
  permissionGranted: boolean | null;
}

export function useTrainerMicSession(recorder: AudioRecorder): TrainerMicSession {
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  // recorder는 useAudioRecorder가 보통 안정 참조를 반환하지만, ref로 한 번 더
  // 안전망을 두어 cleanup이 항상 최신 인스턴스를 보도록 한다.
  const recorderRef = useRef<AudioRecorder>(recorder);
  recorderRef.current = recorder;

  useEffect(() => {
    let isCancelled = false;

    const setup = async (): Promise<void> => {
      try {
        const { granted } = await requestRecordingPermissionsAsync();
        if (isCancelled) return;
        setPermissionGranted(granted);
        if (granted) {
          // iOS는 playAndRecord로 전환해야 마이크 입력이 들어온다.
          // Android는 무시되지만 호출 자체는 안전.
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        }
      } catch (error) {
        if (isCancelled) return;
        console.warn('[trainer-mic-session] setup failed', error);
        setPermissionGranted(false);
      }
    };

    void setup();

    return () => {
      isCancelled = true;
      void (async () => {
        try {
          const r = recorderRef.current;
          if (r.isRecording) {
            await r.stop();
          }
        } catch {
          // 이미 정지/해제된 경우 무시.
        }
        try {
          await setAudioModeAsync({ allowsRecording: false });
        } catch {
          // 모드 원복 실패는 치명적이지 않음. 다음 진입 시 다시 시도됨.
        }
      })();
    };
    // 마운트~언마운트 1회만 실행되며, 최신 recorder는 ref로 안전하게 참조.
  }, []);

  return { permissionGranted };
}
