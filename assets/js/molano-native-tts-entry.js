import { TextToSpeech } from "@capacitor-community/text-to-speech";

// Bundled into the installed Android app; uses Android's native TextToSpeech engine.
window.ZakiTechNativeTTS = {
  speak: options => TextToSpeech.speak({ ...options, queueStrategy: 0 }),
  stop: () => TextToSpeech.stop()
};
