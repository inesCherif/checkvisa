// Minimal typings for Chrome's built-in Prompt API (window.LanguageModel).
// We only use it to *read* on-device availability for the status panel.
// All inference goes through Firebase AI Logic (firebase/ai).
export {};

declare global {
  type LanguageModelAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

  interface LanguageModelExpectedIO {
    type: 'text' | 'image' | 'audio';
    languages?: string[];
  }

  interface LanguageModelStatic {
    availability(options?: {
      expectedInputs?: LanguageModelExpectedIO[];
      expectedOutputs?: LanguageModelExpectedIO[];
    }): Promise<LanguageModelAvailability>;
  }

  // eslint-disable-next-line no-var
  var LanguageModel: LanguageModelStatic | undefined;

  // App Check debug token switch used on localhost (see src/firebase/init.ts).
  // eslint-disable-next-line no-var
  var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined;
}
