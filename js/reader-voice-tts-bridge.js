// WordJar Reader Voice TTS Bridge V1
// Applies Reader Voice Settings to the Reader storytelling TTS right before speech starts.

(function installWordJarReaderVoiceTTSBridge() {
  if (window.__wordjarReaderVoiceTTSBridgeInstalled) return;
  window.__wordjarReaderVoiceTTSBridgeInstalled = true;

  const DEFAULT_ACCENT = 'en-GB';
  const DEFAULT_SPEED = 0.8;

  function isReaderTTSActive() {
    const btn = document.getElementById('wordjarReaderTTSButton');
    return curPage === 'reader' && !!btn?.classList.contains('is-reading');
  }

  function ensureSettings() {
    if (window.WordJarReaderVoiceSettings?.ensure) {
      WordJarReaderVoiceSettings.ensure();
      return;
    }

    D.profile = D.profile || {};
    if (!D.profile.readerVoiceAccent) D.profile.readerVoiceAccent = DEFAULT_ACCENT;
    const speed = Number(D.profile.readerVoiceSpeed);
    if (!Number.isFinite(speed) || speed < 0.5 || speed > 1.25) D.profile.readerVoiceSpeed = DEFAULT_SPEED;
  }

  function getAccent() {
    ensureSettings();
    return window.WordJarReaderVoiceSettings?.getAccent?.() || D.profile?.readerVoiceAccent || DEFAULT_ACCENT;
  }

  function getSpeed() {
    ensureSettings();
    const speed = window.WordJarReaderVoiceSettings?.getSpeed?.() || Number(D.profile?.readerVoiceSpeed || DEFAULT_SPEED);
    return Math.max(0.5, Math.min(1.25, speed));
  }

  function chooseVoice(accent) {
    if (window.WordJarReaderVoiceSettings?.chooseVoice) {
      return WordJarReaderVoiceSettings.chooseVoice(accent);
    }

    const voices = window.speechSynthesis?.getVoices?.() || [];
    return voices.find(voice => voice.lang === accent) ||
      voices.find(voice => String(voice.lang || '').toLowerCase().startsWith(String(accent || '').toLowerCase())) ||
      voices.find(voice => /^en-GB/i.test(voice.lang || '')) ||
      voices.find(voice => /^en/i.test(voice.lang || '')) ||
      null;
  }

  function applyReaderVoiceSettings(utterance) {
    if (!utterance || !isReaderTTSActive()) return utterance;

    const accent = getAccent();
    utterance.lang = accent;
    utterance.rate = getSpeed();
    utterance.pitch = 1;

    const voice = chooseVoice(accent);
    if (voice) utterance.voice = voice;
    return utterance;
  }

  function patchSpeak() {
    if (!window.speechSynthesis || window.speechSynthesis.__wordjarReaderVoiceSpeakPatched) return;

    const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.__wordjarReaderVoiceSpeakPatched = true;

    window.speechSynthesis.speak = function speakWithReaderVoiceSettings(utterance) {
      return originalSpeak(applyReaderVoiceSettings(utterance));
    };
  }

  function boot() {
    ensureSettings();
    patchSpeak();
  }

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 300);
})();
