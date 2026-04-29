// WordJar Reader Voice Settings
// Clean iOS-style voice settings panel with clear accent labels.

(function installWordJarReaderVoiceSettings() {
  if (window.__wordjarReaderVoiceSettingsInstalledV3) return;
  window.__wordjarReaderVoiceSettingsInstalledV3 = true;

  const STYLE_ID = 'wordjarReaderVoiceSettingsStyle';
  const PANEL_ID = 'wordjarReaderVoiceSettingsPanel';
  const GENERAL_PANEL_ID = 'wordjarGeneralVoiceSpeedPanel';

  const ACCENTS = [
    { value: 'en-US', label: 'American (US)', keywords: /\b(us|united states|american|samantha|alex|ava|allison)\b/i },
    { value: 'en-GB', label: 'British (UK)', keywords: /\b(uk|british|england|daniel|serena|kate|arthur)\b/i },
    { value: 'en-AU', label: 'Australian (AU)', keywords: /\b(australia|australian|karen)\b/i },
    { value: 'en-CA', label: 'Canadian (CA)', keywords: /\b(canada|canadian)\b/i },
    { value: 'en-IE', label: 'Irish (IE)', keywords: /\b(ireland|irish)\b/i },
    { value: 'en-IN', label: 'Indian (IN)', keywords: /\b(india|indian|rishi)\b/i }
  ];

  function ensureReaderVoiceSettings() {
    window.D = window.D || {};
    D.profile = D.profile || {};

    if (!D.profile.voice) D.profile.voice = 'en-US';
    if (!D.profile.readerVoiceAccent) D.profile.readerVoiceAccent = 'en-GB';

    const readerSpeed = Number(D.profile.readerVoiceSpeed);
    if (!Number.isFinite(readerSpeed) || readerSpeed < 0.5 || readerSpeed > 1.25) {
      D.profile.readerVoiceSpeed = 0.8;
    }

    const mainSpeed = Number(D.profile.voiceSpeed);
    if (!Number.isFinite(mainSpeed) || mainSpeed < 0.5 || mainSpeed > 1.5) {
      D.profile.voiceSpeed = 1;
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .wordjar-voice-clean-section {
        margin-top: 18px;
        padding-top: 18px;
        border-top: 1px solid var(--bdr);
      }

      .wordjar-voice-clean-title {
        color: var(--ink);
        font-size: 17px;
        font-weight: 950;
        letter-spacing: -0.03em;
        line-height: 1.2;
        margin-bottom: 6px;
      }

      .wordjar-voice-clean-subtitle {
        color: var(--ink2);
        font-size: 12px;
        font-weight: 750;
        line-height: 1.45;
        margin-bottom: 14px;
      }

      .wordjar-voice-clean-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 14px;
      }

      .wordjar-voice-clean-label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .wordjar-voice-clean-label {
        color: var(--ink);
        font-size: 13px;
        font-weight: 900;
        letter-spacing: -0.01em;
      }

      .wordjar-voice-clean-value {
        color: var(--ink2);
        font-size: 13px;
        font-weight: 900;
        white-space: nowrap;
      }

      .wordjar-voice-clean-select {
        width: 100%;
        height: 48px;
        border: 1px solid var(--bdr);
        border-radius: 18px;
        background: var(--sur);
        color: var(--ink);
        font: inherit;
        font-size: 15px;
        font-weight: 850;
        padding: 0 14px;
        outline: none;
        position: relative;
        z-index: 1;
      }

      .wordjar-voice-tube-wrap {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
      }

      .wordjar-voice-tube-mark {
        color: var(--ink2);
        font-size: 11px;
        font-weight: 850;
        min-width: 38px;
      }

      .wordjar-voice-tube-mark:last-child {
        text-align: right;
      }

      .wordjar-voice-tube-range {
        --wordjar-range-fill: 50%;
        width: 100%;
        height: 28px;
        appearance: none;
        -webkit-appearance: none;
        background: transparent;
        outline: none;
      }

      .wordjar-voice-tube-range::-webkit-slider-runnable-track {
        height: 8px;
        border-radius: 999px;
        background: linear-gradient(to right, var(--ink) 0%, var(--ink) var(--wordjar-range-fill), var(--bdr) var(--wordjar-range-fill), var(--bdr) 100%);
      }

      .wordjar-voice-tube-range::-webkit-slider-thumb {
        appearance: none;
        -webkit-appearance: none;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        border: 1px solid rgba(0,0,0,.08);
        background: var(--sur);
        box-shadow: 0 4px 14px rgba(0,0,0,.18);
        margin-top: -11px;
        cursor: pointer;
      }

      .wordjar-voice-tube-range::-moz-range-track {
        height: 8px;
        border-radius: 999px;
        background: var(--bdr);
      }

      .wordjar-voice-tube-range::-moz-range-progress {
        height: 8px;
        border-radius: 999px;
        background: var(--ink);
      }

      .wordjar-voice-tube-range::-moz-range-thumb {
        width: 30px;
        height: 30px;
        border-radius: 999px;
        border: 1px solid rgba(0,0,0,.08);
        background: var(--sur);
        box-shadow: 0 4px 14px rgba(0,0,0,.18);
        cursor: pointer;
      }

      .wordjar-reader-voice-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 12px;
      }

      .wordjar-reader-voice-btn {
        height: 46px;
        border: 1px solid var(--bdr);
        border-radius: 17px;
        background: var(--sur);
        color: var(--ink);
        font: inherit;
        font-size: 14px;
        font-weight: 900;
        cursor: pointer;
      }

      .wordjar-reader-voice-btn.primary {
        background: var(--ink);
        border-color: var(--ink);
        color: var(--sur);
      }

      .wordjar-voice-hidden-speed-field,
      .wordjar-voice-original-actions-hidden {
        display: none;
      }
    `;

    document.head.appendChild(style);
  }

  function speedLabel(value) {
    return `${Number(value).toFixed(2)}×`;
  }

  function getAccentLabel(value, fallbackText = '') {
    const text = String(fallbackText || '').toLowerCase();
    const accent = ACCENTS.find(item => item.value === value) ||
      ACCENTS.find(item => item.keywords.test(text)) ||
      ACCENTS.find(item => text.includes(item.label.toLowerCase()));

    return accent?.label || fallbackText || value;
  }

  function getAccent() {
    ensureReaderVoiceSettings();
    return D.profile.readerVoiceAccent || 'en-GB';
  }

  function getGeneralAccent() {
    ensureReaderVoiceSettings();
    return D.profile.voice || 'en-US';
  }

  function getReaderSpeed() {
    ensureReaderVoiceSettings();
    return Math.max(0.5, Math.min(1.25, Number(D.profile.readerVoiceSpeed || 0.8)));
  }

  function getGeneralSpeed() {
    ensureReaderVoiceSettings();
    return Math.max(0.5, Math.min(1.5, Number(D.profile.voiceSpeed || 1)));
  }

  function setRangeFill(input) {
    if (!input) return;

    const min = Number(input.min || 0);
    const max = Number(input.max || 1);
    const value = Number(input.value || min);
    const percent = ((value - min) / (max - min)) * 100;

    input.style.setProperty('--wordjar-range-fill', `${Math.max(0, Math.min(100, percent))}%`);
  }

  function findVoiceModalCard() {
    const explicitModal = document.getElementById('voiceModal') || document.getElementById('voiceSettingsModal');
    if (explicitModal) return explicitModal.querySelector('.modal-card') || explicitModal;

    const openCards = Array.from(document.querySelectorAll('.overlay.open .modal-card'));
    return openCards.find(card => /voice|เสียง|accent|speed|auto play/i.test(card.textContent || '')) || openCards.at(-1) || null;
  }

  function findBlockByLabel(card, labelText) {
    const lower = labelText.toLowerCase();
    const labels = Array.from(card.querySelectorAll('label, .fl, div, span'));
    const label = labels.find(el => String(el.textContent || '').trim().toLowerCase() === lower);
    if (!label) return null;

    let node = label;
    for (let i = 0; i < 5 && node && node !== card; i++) {
      if (node.querySelector?.('select, input[type="range"], input[type="checkbox"]')) return node;
      node = node.parentElement;
    }

    return label.parentElement;
  }

  function findControlByLabel(card, labelText, selector) {
    const block = findBlockByLabel(card, labelText);
    return block?.querySelector?.(selector) || null;
  }

  function normalizeAccentSelect(select, shouldAddMissingOptions = false) {
    if (!select) return;

    Array.from(select.options || []).forEach(option => {
      option.textContent = getAccentLabel(option.value, option.textContent);
    });

    if (!shouldAddMissingOptions) return;

    ACCENTS.forEach(item => {
      if (!Array.from(select.options || []).some(option => option.value === item.value)) {
        select.add(new Option(item.label, item.value));
      }
    });
  }

  function relabelOriginalFields(card) {
    const replacements = [
      ['Voice Accent', 'General voice accent'],
      ['Auto Fill IPA Accent', 'IPA accent for Smart Fill'],
      ['Auto-play Audio', 'Auto-play Audio']
    ];

    replacements.forEach(([from, to]) => {
      const block = findBlockByLabel(card, from);
      const label = block?.querySelector?.('label, .fl') || block;
      if (label && String(label.textContent || '').trim() === from) label.textContent = to;
    });

    normalizeAccentSelect(findControlByLabel(card, 'General voice accent', 'select'), true);
    normalizeAccentSelect(findControlByLabel(card, 'IPA accent for Smart Fill', 'select'), false);
  }

  function syncOriginalSpeedSelect(speed) {
    const card = findVoiceModalCard();
    const select = card ? findControlByLabel(card, 'Reading Speed', 'select') : null;
    if (!select) return;

    const target = Number(speed);
    const options = Array.from(select.options || []);
    const best = options.find(option => String(option.value) === String(target)) ||
      options.find(option => Math.abs(Number(option.value) - target) < 0.06) ||
      options.find(option => /normal|1x/i.test(option.textContent || ''));

    if (best) {
      select.value = best.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function syncOriginalAccentSelect(value) {
    const card = findVoiceModalCard();
    const select = card ? findControlByLabel(card, 'General voice accent', 'select') : null;
    if (!select) return;

    normalizeAccentSelect(select, true);
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function saveGeneralVoiceAccent(value) {
    ensureReaderVoiceSettings();
    D.profile.voice = ACCENTS.some(item => item.value === value) ? value : 'en-US';
    syncOriginalAccentSelect(D.profile.voice);
    if (typeof save === 'function') save();
  }

  function saveGeneralVoiceSpeed(value) {
    ensureReaderVoiceSettings();
    const speed = Math.max(0.5, Math.min(1.5, Number(value || 1)));
    D.profile.voiceSpeed = Number(speed.toFixed(2));
    syncOriginalSpeedSelect(speed);
    if (typeof save === 'function') save();
  }

  function saveReaderVoiceAccent(value) {
    ensureReaderVoiceSettings();
    D.profile.readerVoiceAccent = ACCENTS.some(item => item.value === value) ? value : 'en-GB';
    if (typeof save === 'function') save();
  }

  function saveReaderVoiceSpeed(value) {
    ensureReaderVoiceSettings();
    const speed = Math.max(0.5, Math.min(1.25, Number(value || 0.8)));
    D.profile.readerVoiceSpeed = Number(speed.toFixed(2));
    if (typeof save === 'function') save();
  }

  function chooseVoice(accent = getAccent()) {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    const option = ACCENTS.find(item => item.value === accent) || ACCENTS[0];

    return voices.find(voice => voice.lang === option.value) ||
      voices.find(voice => String(voice.lang || '').toLowerCase().startsWith(option.value.toLowerCase())) ||
      voices.find(voice => option.keywords.test(voice.name || '') && /^en/i.test(voice.lang || '')) ||
      voices.find(voice => /^en-GB/i.test(voice.lang || '')) ||
      voices.find(voice => /^en/i.test(voice.lang || '')) ||
      null;
  }

  function stopPreview() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (typeof window.stopWordJarReaderTTS === 'function') window.stopWordJarReaderTTS();
  }

  function previewVoice(text, accent, speed) {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      if (typeof toast === 'function') toast('Text to speech is not supported in this browser');
      return;
    }

    stopPreview();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = accent;
    utterance.rate = speed;
    utterance.pitch = 1;

    const voice = chooseVoice(accent);
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
  }

  function previewGeneralVoice() {
    previewVoice('This is your WordJar study voice.', getGeneralAccent(), getGeneralSpeed());
  }

  function previewReaderVoice() {
    previewVoice('Where is Papa going with that axe?', getAccent(), getReaderSpeed());
  }

  function hideOriginalSpeedDropdown(card) {
    const block = findBlockByLabel(card, 'Reading Speed');
    if (block) block.classList.add('wordjar-voice-hidden-speed-field');
  }

  function hideOriginalModalActions(card) {
    if (!card) return;

    const candidates = Array.from(card.querySelectorAll('.form-row, .action-row, .modal-actions, div'));
    const actionRow = candidates.find(row => {
      if (row.id === GENERAL_PANEL_ID || row.id === PANEL_ID) return false;
      if (row.closest(`#${GENERAL_PANEL_ID}, #${PANEL_ID}`)) return false;

      const text = String(row.textContent || '').replace(/\s+/g, ' ').trim();
      const buttons = Array.from(row.querySelectorAll('button'));
      return buttons.length >= 2 && /\bCancel\b/i.test(text) && /\bSave Settings\b/i.test(text);
    });

    if (!actionRow) return;

    actionRow.classList.add('wordjar-voice-original-actions-hidden');
    Array.from(actionRow.querySelectorAll('button')).forEach(button => {
      button.tabIndex = -1;
      button.setAttribute('aria-hidden', 'true');
    });
  }

  function accentOptions(selectedValue) {
    return ACCENTS.map(item => `<option value="${item.value}"${item.value === selectedValue ? ' selected' : ''}>${item.label}</option>`).join('');
  }

  function mountGeneralVoicePanel(card) {
    if (!card || document.getElementById(GENERAL_PANEL_ID)) return;

    const panel = document.createElement('div');
    panel.id = GENERAL_PANEL_ID;
    panel.className = 'wordjar-voice-clean-section';
    panel.innerHTML = `
      <div class="wordjar-voice-clean-title">General / Flashcard Voice</div>
      <div class="wordjar-voice-clean-subtitle">ใช้กับปุ่ม Listen, Flashcard และ Study Mode ทั่วไป</div>

      <div class="wordjar-voice-clean-field">
        <label class="wordjar-voice-clean-label" for="wordjarGeneralVoiceAccent">General voice accent</label>
        <select id="wordjarGeneralVoiceAccent" class="wordjar-voice-clean-select">
          ${accentOptions(getGeneralAccent())}
        </select>
      </div>

      <div class="wordjar-voice-clean-field">
        <div class="wordjar-voice-clean-label-row">
          <label class="wordjar-voice-clean-label" for="wordjarGeneralVoiceSpeed">Speed</label>
          <span id="wordjarGeneralVoiceSpeedValue" class="wordjar-voice-clean-value">${speedLabel(getGeneralSpeed())}</span>
        </div>
        <div class="wordjar-voice-tube-wrap">
          <span class="wordjar-voice-tube-mark">Slow</span>
          <input id="wordjarGeneralVoiceSpeed" class="wordjar-voice-tube-range" type="range" min="0.5" max="1.5" step="0.05" value="${getGeneralSpeed()}">
          <span class="wordjar-voice-tube-mark">Fast</span>
        </div>
      </div>

      <div class="wordjar-reader-voice-actions">
        <button type="button" class="wordjar-reader-voice-btn" id="wordjarGeneralVoicePreviewBtn">Preview</button>
        <button type="button" class="wordjar-reader-voice-btn primary" id="wordjarGeneralVoiceDefaultBtn">Normal 1×</button>
      </div>
    `;

    const autoPlayBlock = findBlockByLabel(card, 'Auto-play Audio');
    if (autoPlayBlock?.parentElement === card) card.insertBefore(panel, autoPlayBlock);
    else card.appendChild(panel);

    const accent = document.getElementById('wordjarGeneralVoiceAccent');
    const speed = document.getElementById('wordjarGeneralVoiceSpeed');
    const speedValue = document.getElementById('wordjarGeneralVoiceSpeedValue');
    const preview = document.getElementById('wordjarGeneralVoicePreviewBtn');
    const reset = document.getElementById('wordjarGeneralVoiceDefaultBtn');

    setRangeFill(speed);

    accent.onchange = () => {
      saveGeneralVoiceAccent(accent.value);
      if (typeof toast === 'function') toast('General voice accent saved');
    };

    speed.oninput = () => {
      setRangeFill(speed);
      speedValue.textContent = speedLabel(speed.value);
    };

    speed.onchange = () => {
      saveGeneralVoiceSpeed(speed.value);
      speedValue.textContent = speedLabel(getGeneralSpeed());
      setRangeFill(speed);
      if (typeof toast === 'function') toast('General voice speed saved');
    };

    preview.onclick = previewGeneralVoice;

    reset.onclick = () => {
      saveGeneralVoiceSpeed(1);
      speed.value = getGeneralSpeed();
      speedValue.textContent = speedLabel(getGeneralSpeed());
      setRangeFill(speed);
      previewGeneralVoice();
    };
  }

  function mountReaderVoicePanel(card) {
    if (!card || document.getElementById(PANEL_ID)) return;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'wordjar-voice-clean-section';
    panel.innerHTML = `
      <div class="wordjar-voice-clean-title">Reader Voice</div>
      <div class="wordjar-voice-clean-subtitle">ใช้เฉพาะปุ่ม Listen ใน Reader View สำหรับอ่าน story ให้ช้าลงและฟังชัดขึ้น</div>

      <div class="wordjar-voice-clean-field">
        <label class="wordjar-voice-clean-label" for="wordjarReaderVoiceAccent">Reader accent</label>
        <select id="wordjarReaderVoiceAccent" class="wordjar-voice-clean-select">
          ${accentOptions(getAccent())}
        </select>
      </div>

      <div class="wordjar-voice-clean-field">
        <div class="wordjar-voice-clean-label-row">
          <label class="wordjar-voice-clean-label" for="wordjarReaderVoiceSpeed">Reader speed</label>
          <span id="wordjarReaderVoiceSpeedValue" class="wordjar-voice-clean-value">${speedLabel(getReaderSpeed())}</span>
        </div>
        <div class="wordjar-voice-tube-wrap">
          <span class="wordjar-voice-tube-mark">Slow</span>
          <input id="wordjarReaderVoiceSpeed" class="wordjar-voice-tube-range" type="range" min="0.5" max="1.25" step="0.05" value="${getReaderSpeed()}">
          <span class="wordjar-voice-tube-mark">Fast</span>
        </div>
      </div>

      <div class="wordjar-reader-voice-actions">
        <button type="button" class="wordjar-reader-voice-btn" id="wordjarReaderVoicePreviewBtn">Preview</button>
        <button type="button" class="wordjar-reader-voice-btn primary" id="wordjarReaderVoiceDefaultBtn">A2 Default</button>
      </div>
    `;

    card.appendChild(panel);

    const accent = document.getElementById('wordjarReaderVoiceAccent');
    const speed = document.getElementById('wordjarReaderVoiceSpeed');
    const speedValue = document.getElementById('wordjarReaderVoiceSpeedValue');
    const preview = document.getElementById('wordjarReaderVoicePreviewBtn');
    const reset = document.getElementById('wordjarReaderVoiceDefaultBtn');

    setRangeFill(speed);

    accent.onchange = () => {
      saveReaderVoiceAccent(accent.value);
      if (typeof toast === 'function') toast('Reader accent saved');
    };

    speed.oninput = () => {
      setRangeFill(speed);
      speedValue.textContent = speedLabel(speed.value);
    };

    speed.onchange = () => {
      saveReaderVoiceSpeed(speed.value);
      speedValue.textContent = speedLabel(getReaderSpeed());
      setRangeFill(speed);
      if (typeof toast === 'function') toast('Reader speed saved');
    };

    preview.onclick = previewReaderVoice;

    reset.onclick = () => {
      saveReaderVoiceAccent('en-GB');
      saveReaderVoiceSpeed(0.8);
      accent.value = getAccent();
      speed.value = getReaderSpeed();
      speedValue.textContent = speedLabel(getReaderSpeed());
      setRangeFill(speed);
      previewReaderVoice();
    };
  }

  function mountSettings() {
    ensureReaderVoiceSettings();
    injectStyles();

    const card = findVoiceModalCard();
    if (!card) return;

    relabelOriginalFields(card);
    hideOriginalSpeedDropdown(card);
    hideOriginalModalActions(card);
    mountGeneralVoicePanel(card);
    mountReaderVoicePanel(card);
  }

  function patchOpenVoiceModal() {
    if (window.__wordjarReaderVoiceOpenModalPatchedV3) return;

    const original = window.openVoiceModal;
    if (typeof original !== 'function') return;

    window.__wordjarReaderVoiceOpenModalPatchedV3 = true;
    window.openVoiceModal = function openVoiceModalWithReaderSettings() {
      const result = original.apply(this, arguments);
      setTimeout(mountSettings, 0);
      setTimeout(mountSettings, 120);
      setTimeout(mountSettings, 360);
      return result;
    };
  }

  function boot() {
    ensureReaderVoiceSettings();
    injectStyles();
    patchOpenVoiceModal();
    mountSettings();
  }

  window.WordJarReaderVoiceSettings = {
    accents: ACCENTS,
    ensure: ensureReaderVoiceSettings,
    getAccent,
    getGeneralAccent,
    getSpeed: getReaderSpeed,
    getReaderSpeed,
    getGeneralSpeed,
    chooseVoice,
    mountSettings,
    preview: previewReaderVoice,
    stopPreview
  };

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 350);

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => chooseVoice(getAccent());
  }
})();
