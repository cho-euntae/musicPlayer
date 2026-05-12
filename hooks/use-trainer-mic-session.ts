import { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
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
//  3) 화면 이탈 시 (recorder가 있으면) 녹음 중지 + 임시 녹음 파일 삭제 + 모드 원복
//     (allowsRecording: false)
//
// recorder 인자는 optional이다.
//  - mic-test처럼 expo-audio의 useAudioRecorder를 쓰는 화면은 인스턴스를 넘긴다.
//  - range-test처럼 react-native-pitchy가 자체 마이크 캡처를 하는 화면은 인자 없이
//    호출한다. 이 경우 권한+오디오 모드 전환만 처리하고 cleanupRecording은 no-op.
//
// 분리 이유:
//  - 화면(mic-test, pitch 인식 화면 등)이 추가되어도 권한/모드/파일 정리 정책이
//    한 곳에서 관리되어야 일관성이 깨지지 않는다.
//  - 화면 컴포넌트는 UI 책임에 집중하고, 세션은 훅이 담당.
//
// 보안 메모:
//  - HIGH_QUALITY preset 등으로 녹음을 시작하면 디스크에 임시 wav가 생성된다.
//  - 입력 레벨 측정만 하더라도 prepareToRecord/start 흐름에서 파일이 만들어질 수
//    있으므로, 본 훅은 화면 이탈 시 `recorder.uri`를 idempotent로 삭제한다.
//  - 외부 호출자가 stop 직후 명시적으로 정리하고 싶다면 `cleanupRecording()`을 직접
//    호출할 수도 있다.

export interface TrainerMicSession {
  permissionGranted: boolean | null;
  // stop 후 임시 파일을 즉시 지우고 싶을 때 호출. 안전한 idempotent 동작.
  // recorder를 넘기지 않은 호출에서는 no-op.
  cleanupRecording: () => Promise<void>;
}

async function deleteRecordingFile(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error) {
    // 이미 삭제됐거나 파일이 없는 경우는 무시. 그 외 오류만 경고.
    console.warn('[trainer-mic-session] delete recording failed', error);
  }
}

export function useTrainerMicSession(recorder?: AudioRecorder): TrainerMicSession {
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  // recorder는 useAudioRecorder가 보통 안정 참조를 반환하지만, ref로 한 번 더
  // 안전망을 두어 cleanup이 항상 최신 인스턴스를 보도록 한다.
  const recorderRef = useRef<AudioRecorder | undefined>(recorder);
  recorderRef.current = recorder;

  const cleanupRecording = useCallback(async (): Promise<void> => {
    const r = recorderRef.current;
    if (!r) return; // recorder를 쓰지 않는 화면 (예: pitchy 자체 캡처)에서는 no-op.
    let uriBeforeStop: string | null = null;
    try {
      // 일부 SDK 빌드는 stop 후 uri가 사라지므로 미리 캡처.
      uriBeforeStop = (r as unknown as { uri?: string | null }).uri ?? null;
    } catch {
      uriBeforeStop = null;
    }
    try {
      if (r.isRecording) {
        await r.stop();
      }
    } catch {
      // 이미 정지/해제된 경우 무시.
    }
    // stop 후 uri가 갱신될 수도 있으니 둘 다 시도 (idempotent라 안전).
    let uriAfterStop: string | null = null;
    try {
      uriAfterStop = (r as unknown as { uri?: string | null }).uri ?? null;
    } catch {
      uriAfterStop = null;
    }
    await deleteRecordingFile(uriBeforeStop);
    if (uriAfterStop && uriAfterStop !== uriBeforeStop) {
      await deleteRecordingFile(uriAfterStop);
    }
  }, []);

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
        // 1) 녹음 정지 + 임시 파일 삭제
        await cleanupRecording();
        // 2) 오디오 모드 원복
        try {
          await setAudioModeAsync({ allowsRecording: false });
        } catch {
          // 모드 원복 실패는 치명적이지 않음. 다음 진입 시 다시 시도됨.
        }
      })();
    };
    // 마운트~언마운트 1회만 실행. cleanupRecording은 useCallback으로 안정 참조.
  }, [cleanupRecording]);

  return { permissionGranted, cleanupRecording };
}
