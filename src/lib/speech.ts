// Speech-to-text for "Say it". The native module is only in real builds (the APK), not in Expo Go,
// so it's loaded lazily; without it, the app falls back to the keyboard's own voice typing.
type SpeechModule = typeof import('expo-speech-recognition');

let mod: SpeechModule | null | undefined;
function load(): SpeechModule | null {
  if (mod === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('expo-speech-recognition') as SpeechModule;
    } catch {
      mod = null;
    }
  }
  return mod;
}

export const speechAvailable = () => {
  const m = load();
  try {
    return !!m && m.ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
};

/** Starts listening. Calls onText with the transcript so far, then onEnd once. Returns a stop function. */
export async function listen(handlers: {
  onText: (text: string, final: boolean) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}): Promise<() => void> {
  const m = load();
  if (!m) throw new Error('unavailable');
  const S = m.ExpoSpeechRecognitionModule;
  const perm = await S.requestPermissionsAsync();
  if (!perm.granted) throw new Error('Microphone permission was denied.');

  const subs = [
    S.addListener('result', (e) => handlers.onText(e.results[0]?.transcript ?? '', e.isFinal)),
    S.addListener('error', (e) => handlers.onError(e.error === 'no-speech' ? "Didn't catch that. Try again." : e.message)),
    S.addListener('end', () => {
      subs.forEach((s) => s.remove());
      handlers.onEnd();
    }),
  ];
  S.start({ lang: 'en-US', interimResults: true, continuous: false });
  return () => S.stop();
}
