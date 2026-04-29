// WordJar Reader Story TTS Fix V3
// Language Reactor style: centered mini gloss, spoken-word marker, double-tap pause/resume, outside tap stop.

(function installWordJarReaderStoryTTSFix() {
  if (window.__wordjarReaderStoryTTSFixInstalledV3) return;
  window.__wordjarReaderStoryTTSFixInstalledV3 = true;

  const STYLE_ID = 'wordjarReaderStoryTTSStyle';
  const TTS_BUTTON_ID = 'wordjarReaderTTSButton';
  const MINI_GLOSS_ID = 'wordjarReaderMiniGloss';
  const TTS_RATE = 0.8;
  const TTS_LANG = 'en-GB';
  const SENTENCE_PAUSE_MS = 450;
  const DOUBLE_TAP_MS = 320;

  const STARTER_DICT = {
    aggravate: { type: 'V', en: 'to make a situation worse; to annoy someone', th: 'ทำให้แย่ลง; ทำให้รำคาญ', ipa: '/ˈæɡ.rə.veɪt/' },
    wary: { type: 'ADJ', en: 'careful because something may be dangerous or cause problems', th: 'ระมัดระวัง เพราะอาจมีอันตรายหรือปัญหา', ipa: '/ˈweə.ri/' },
    ephemeral: { type: 'ADJ', en: 'lasting for only a short time', th: 'อยู่เพียงช่วงเวลาสั้น ๆ', ipa: '/ɪˈfem.ər.əl/' },
    consider: { type: 'V', en: 'to think carefully about something', th: 'พิจารณา; คิดอย่างรอบคอบ', ipa: '/kənˈsɪd.ər/' },
    improve: { type: 'V', en: 'to become better or make something better', th: 'ปรับปรุง; ทำให้ดีขึ้น', ipa: '/ɪmˈpruːv/' },
    context: { type: 'N', en: 'the situation or words around something that help explain it', th: 'บริบท; ข้อความหรือสถานการณ์แวดล้อม', ipa: '/ˈkɑːn.tekst/' },
    translate: { type: 'V', en: 'to change words from one language into another', th: 'แปลภาษา', ipa: '/trænzˈleɪt/' },
    sentence: { type: 'N', en: 'a group of words that expresses a complete thought', th: 'ประโยค', ipa: '/ˈsen.təns/' },
    meaning: { type: 'N', en: 'the idea or sense of a word or sentence', th: 'ความหมาย', ipa: '/ˈmiː.nɪŋ/' },
    note: { type: 'N', en: 'a short piece of writing to help remember something', th: 'บันทึกย่อ', ipa: '/noʊt/' },
    reader: { type: 'N', en: 'a tool or person that reads text', th: 'เครื่องมืออ่าน; ผู้อ่าน', ipa: '/ˈriː.dɚ/' },
    language: { type: 'N', en: 'a system of words used for communication', th: 'ภาษา', ipa: '/ˈlæŋ.ɡwɪdʒ/' },
    save: { type: 'V', en: 'to keep something for future use', th: 'บันทึก; เก็บไว้ใช้ภายหลัง', ipa: '/seɪv/' },
    deck: { type: 'N', en: 'a group of flashcards for study', th: 'ชุดแฟลชการ์ด', ipa: '/dek/' },
    flashcard: { type: 'N', en: 'a card used for memorizing information', th: 'แฟลชการ์ด; บัตรช่วยจำ', ipa: '/ˈflæʃ.kɑːrd/' }
  };

  const ttsState = {
    active: false,
    paused: false,
    sentenceIndex: 0,
    tokenCursor: 0,
    sentences: [],
    tokens: [],
    utterance: null,
    pauseTimer: null,
    lastMarkedToken: null
  };

  const tapState = {
    token: null,
    word: '',
    time: 0,
    timer: null
  };

  let fullSelectReaderWord = null;

  function injectStyles() {
    const old = document.getElementById(STYLE_ID);
    if (old) old.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .wordjar-reader-tts-btn {
        height: 38px;
        min-width: 38px;
        border: 1px solid var(--bdr);
        border-radius: 999px;
        background: var(--sur);
        color: var(--ink);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        padding: 0 12px;
        font: inherit;
        font-size: 12px;
        font-weight: 850;
        cursor: pointer;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.045);
      }
      .wordjar-reader-tts-btn svg {
        width: 17px;
        height: 17px;
        stroke-width: 2.35;
        flex: 0 0 auto;
      }
      .wordjar-reader-tts-btn.is-reading {
        background: var(--ink);
        border-color: var(--ink);
        color: var(--sur);
      }
      .wordjar-reader-tts-btn.is-paused {
        background: var(--sur2);
        border-color: var(--ink);
        color: var(--ink);
      }
      .wordjar-reader-view-tools {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        margin-left: auto;
      }
      #readerTokens .reader-token { touch-action: manipulation; }
      #readerTokens .reader-token.wordjar-reader-speaking-token,
      #readerTokens .reader-token.wordjar-reader-mini-active {
        background: rgba(220, 252, 231, 0.9);
        box-shadow: 0 0 0 1px rgba(22, 163, 74, 0.22) inset;
        border-radius: 6px;
      }
      #readerTokens .reader-token.wordjar-reader-paused-token {
        background: rgba(254, 249, 195, 0.95);
        box-shadow: 0 0 0 1px rgba(202, 138, 4, 0.26) inset;
      }
      .wordjar-reader-mini-gloss {
        position: fixed;
        left: 50%;
        top: calc(76px + env(safe-area-inset-top, 0px));
        width: min(330px, calc(100vw - 32px));
        max-width: min(330px, calc(100vw - 32px));
        border: 1px solid var(--bdr);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.98);
        color: var(--ink);
        box-shadow: 0 18px 42px rgba(0, 0, 0, 0.18);
        padding: 12px 14px;
        z-index: 450;
        pointer-events: none;
        opacity: 0;
        transform: translateX(-50%) translateY(-8px);
        transition: opacity 0.12s ease, transform 0.12s ease;
        backdrop-filter: blur(12px);
      }
      .wordjar-reader-mini-gloss.open {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      .wordjar-reader-mini-word {
        display: flex;
        align-items: baseline;
        gap: 8px;
        min-width: 0;
        margin-bottom: 4px;
      }
      .wordjar-reader-mini-word b {
        font-size: 17px;
        font-weight: 950;
        letter-spacing: -0.02em;
      }
      .wordjar-reader-mini-pron {
        color: var(--ink2);
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
      }
      .wordjar-reader-mini-meaning {
        color: var(--ink);
        font-size: 14px;
        line-height: 1.38;
        font-weight: 780;
      }
      .wordjar-reader-mini-hint {
        margin-top: 7px;
        color: var(--ink2);
        font-size: 11px;
        font-weight: 800;
      }
      @media (max-width: 420px) {
        .wordjar-reader-tts-btn span { display: none; }
        .wordjar-reader-tts-btn { padding: 0; }
        .wordjar-reader-mini-gloss {
          top: calc(82px + env(safe-area-inset-top, 0px));
          width: min(310px, calc(100vw - 28px));
        }
      }
    `;
    document.head.appendChild(style);
  }

  function escapeText(value) {
    if (typeof escapeHTML === 'function') return escapeHTML(value);
    if (typeof escHTML === 'function') return escHTML(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeToast(message) {
    if (typeof toast === 'function') toast(message);
  }

  function normalizeWord(word) {
    return String(word || '').toLowerCase().replace(/^['’]+|['’]+$/g, '').trim();
  }

  function isReadableWord(value) {
    return /^[A-Za-z]+(?:['’-][A-Za-z]+)?$/.test(String(value || '').trim());
  }

  function speechIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 010 7"/><path d="M18.5 6a8 8 0 010 12"/></svg>`;
  }

  function stopIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>`;
  }

  function playIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="8 5 19 12 8 19 8 5"/></svg>`;
  }

  function lookupMiniInfo(word) {
    const key = normalizeWord(word);
    const mode = D?.reader?.mode || 'en-th';
    const card = (Array.isArray(D.words) ? D.words : []).find(item => normalizeWord(item?.word) === key);

    if (card) {
      const th = String(card.notes || '').startsWith('TH:') ? String(card.notes || '').replace(/^TH:\s*/i, '') : '';
      return {
        word: card.word || word,
        pronunciation: card.pronunciation || '',
        meaning: mode === 'en-th' ? (th || card.meaning || '') : (card.meaning || th || ''),
        source: 'cards'
      };
    }

    const base = STARTER_DICT[key];
    if (base) {
      return {
        word: word,
        pronunciation: base.ipa || '',
        meaning: mode === 'en-th' ? (base.th || base.en || '') : (base.en || base.th || ''),
        source: 'starter'
      };
    }

    return {
      word,
      pronunciation: '',
      meaning: mode === 'en-th' ? 'ยังไม่มีคำแปลใน local dictionary' : 'No local definition yet.',
      source: 'none'
    };
  }

  function getMiniGloss() {
    injectStyles();
    let gloss = document.getElementById(MINI_GLOSS_ID);
    if (!gloss) {
      gloss = document.createElement('div');
      gloss.id = MINI_GLOSS_ID;
      gloss.className = 'wordjar-reader-mini-gloss';
      document.body.appendChild(gloss);
    }
    return gloss;
  }

  function clearMiniActive() {
    document.querySelectorAll('#readerTokens .wordjar-reader-mini-active')
      .forEach(token => token.classList.remove('wordjar-reader-mini-active'));
  }

  function hideMiniGloss() {
    clearMiniActive();
    const gloss = document.getElementById(MINI_GLOSS_ID);
    if (gloss) gloss.classList.remove('open');
  }

  function closeFullReaderPanel() {
    if (typeof window.closeReaderPanel === 'function') window.closeReaderPanel();
    const panel = document.getElementById('readerPanel');
    if (panel) panel.classList.remove('open');
  }

  function positionMiniGloss() {
    const gloss = document.getElementById(MINI_GLOSS_ID);
    if (!gloss) return;
    gloss.style.left = '50%';
    gloss.style.top = `calc(76px + env(safe-area-inset-top, 0px))`;
  }

  function showMiniGloss(token, options = {}) {
    if (!token) return;
    const word = token.dataset.word || token.textContent || '';
    const info = lookupMiniInfo(word);
    const gloss = getMiniGloss();

    closeFullReaderPanel();
    clearMiniActive();
    token.classList.add('wordjar-reader-mini-active');

    const hint = options.fromTTS
      ? (ttsState.paused ? 'Paused · double tap a word to continue' : 'Reading… double tap a word to pause')
      : 'Double tap for details / save';

    gloss.innerHTML = `
      <div class="wordjar-reader-mini-word">
        <b>${escapeText(info.word || word)}</b>
        <span class="wordjar-reader-mini-pron">${escapeText(info.pronunciation || '')}</span>
      </div>
      <div class="wordjar-reader-mini-meaning">${escapeText(info.meaning || '')}</div>
      <div class="wordjar-reader-mini-hint">${escapeText(hint)}</div>
    `;

    gloss.classList.add('open');
    requestAnimationFrame(positionMiniGloss);
  }

  function openFullReaderPopup(token) {
    if (!token) return;
    hideMiniGloss();
    clearReadingMarks();
    if (typeof fullSelectReaderWord === 'function') {
      fullSelectReaderWord(token);
    } else {
      showMiniGloss(token);
    }
  }

  function pauseStoryTTS(token) {
    if (!ttsState.active || ttsState.paused) return;
    clearTimeout(ttsState.pauseTimer);
    ttsState.pauseTimer = null;
    if (window.speechSynthesis?.speaking) window.speechSynthesis.pause();
    ttsState.paused = true;
    if (token) markTokenAsReading(token, { paused: true });
    updateTTSButton();
  }

  function resumeStoryTTS(token) {
    if (!ttsState.active || !ttsState.paused) return;
    ttsState.paused = false;
    if (token) markTokenAsReading(token, { paused: false });
    if (window.speechSynthesis?.paused) window.speechSynthesis.resume();
    else speakNextSentence();
    updateTTSButton();
  }

  function togglePauseStoryTTS(token) {
    if (!ttsState.active) return false;
    if (ttsState.paused) resumeStoryTTS(token || ttsState.lastMarkedToken);
    else pauseStoryTTS(token || ttsState.lastMarkedToken);
    return true;
  }

  function handleReaderWordTap(token) {
    const now = Date.now();
    const word = normalizeWord(token?.dataset?.word || token?.textContent || '');
    const sameToken = tapState.token === token || (tapState.word && tapState.word === word);

    clearTimeout(tapState.timer);

    if (sameToken && now - tapState.time <= DOUBLE_TAP_MS) {
      tapState.token = null;
      tapState.word = '';
      tapState.time = 0;

      if (togglePauseStoryTTS(token)) return;
      openFullReaderPopup(token);
      return;
    }

    tapState.token = token;
    tapState.word = word;
    tapState.time = now;
    showMiniGloss(token, { fromTTS: ttsState.active });
  }

  function patchSelectReaderWord() {
    if (window.__wordjarReaderLanguageReactorSelectPatchedV3) return;
    if (typeof window.selectReaderWord !== 'function') return;

    window.__wordjarReaderLanguageReactorSelectPatchedV3 = true;
    fullSelectReaderWord = window.selectReaderWord;

    window.selectReaderWord = function selectReaderWordLanguageReactor(token) {
      handleReaderWordTap(token);
    };
  }

  function getReaderTextForTTS() {
    const storedText = String(D?.reader?.text || '').trim();
    if (storedText) return storedText;

    const inputText = String(document.getElementById('readerInput')?.value || '').trim();
    if (inputText) return inputText;

    const richView = document.querySelector('#readerTokens .wordjar-reader-rich-view');
    const tokenText = String((richView || document.getElementById('readerTokens'))?.innerText || '').trim();
    return tokenText.replace(/^Opened from saved note\s*·\s*rich format kept\s*/i, '').trim();
  }

  function splitSentences(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    return clean.match(/[^.!?…]+[.!?…]+["'”’)]*|[^.!?…]+$/g)
      ?.map(sentence => sentence.trim())
      .filter(Boolean) || [clean];
  }

  function wordAtBoundary(sentence, charIndex) {
    const index = Math.max(0, Number(charIndex || 0));
    const slice = String(sentence || '').slice(index);
    const direct = slice.match(/[A-Za-z]+(?:['’-][A-Za-z]+)?/);
    if (direct) return direct[0];

    const before = String(sentence || '').slice(0, index + 1).match(/[A-Za-z]+(?:['’-][A-Za-z]+)?$/);
    return before ? before[0] : '';
  }

  function collectReaderTokens() {
    return Array.from(document.querySelectorAll('#readerTokens .reader-token'))
      .filter(token => isReadableWord(token.dataset.word || token.textContent));
  }

  function bindReaderTokenDictionaryFix() {
    const tokensEl = document.getElementById('readerTokens');
    if (!tokensEl || tokensEl.__wordjarLanguageReactorTapBoundV3) return;
    tokensEl.__wordjarLanguageReactorTapBoundV3 = true;

    tokensEl.addEventListener('click', event => {
      const token = event.target?.closest?.('.reader-token');
      if (!token || !tokensEl.contains(token)) return;

      event.preventDefault();
      event.stopPropagation();
      handleReaderWordTap(token);
    }, true);
  }

  function bindOutsideClose() {
    if (document.__wordjarReaderMiniGlossOutsideBoundV3) return;
    document.__wordjarReaderMiniGlossOutsideBoundV3 = true;

    document.addEventListener('click', event => {
      const token = event.target?.closest?.('#readerTokens .reader-token');
      const ttsBtn = event.target?.closest?.(`#${TTS_BUTTON_ID}`);
      const miniGloss = event.target?.closest?.(`#${MINI_GLOSS_ID}`);
      if (token || ttsBtn || miniGloss) return;

      if (ttsState.active) {
        stopStoryTTS();
        return;
      }
      hideMiniGloss();
    }, true);

    document.addEventListener('scroll', () => {
      if (ttsState.active) positionMiniGloss();
      else hideMiniGloss();
    }, true);
  }

  function chooseUKVoice() {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    return voices.find(voice => /^en-GB$/i.test(voice.lang)) ||
      voices.find(voice => /^en-GB/i.test(voice.lang)) ||
      voices.find(voice => /\b(uk|british|england|daniel|serena|kate|arthur)\b/i.test(voice.name) && /^en/i.test(voice.lang)) ||
      voices.find(voice => /^en/i.test(voice.lang)) ||
      null;
  }

  function updateTTSButton() {
    const btn = document.getElementById(TTS_BUTTON_ID);
    if (!btn) return;
    btn.classList.toggle('is-reading', ttsState.active && !ttsState.paused);
    btn.classList.toggle('is-paused', ttsState.active && ttsState.paused);
    btn.innerHTML = ttsState.active
      ? (ttsState.paused ? `${playIcon()}<span>Resume</span>` : `${stopIcon()}<span>Stop</span>`)
      : `${speechIcon()}<span>Listen</span>`;
    btn.setAttribute('aria-label', ttsState.active ? (ttsState.paused ? 'Resume reading' : 'Stop reading') : 'Listen to Reader View');
  }

  function ensureTTSButton() {
    injectStyles();
    const title = document.querySelector('.reader-view-title');
    if (!title || document.getElementById(TTS_BUTTON_ID)) return;

    const hint = title.querySelector('span');
    const tools = document.createElement('div');
    tools.className = 'wordjar-reader-view-tools';

    const btn = document.createElement('button');
    btn.id = TTS_BUTTON_ID;
    btn.className = 'wordjar-reader-tts-btn';
    btn.type = 'button';
    btn.onclick = () => window.toggleWordJarReaderTTS();
    tools.appendChild(btn);

    if (hint) {
      tools.appendChild(hint);
      title.appendChild(tools);
    } else {
      title.appendChild(tools);
    }

    updateTTSButton();
  }

  function clearReadingMarks() {
    document.querySelectorAll('#readerTokens .wordjar-reader-speaking-token, #readerTokens .wordjar-reader-paused-token')
      .forEach(token => token.classList.remove('wordjar-reader-speaking-token', 'wordjar-reader-paused-token'));
  }

  function markTokenAsReading(token, options = {}) {
    if (!token) return;
    clearReadingMarks();
    token.classList.add('wordjar-reader-speaking-token');
    token.classList.toggle('wordjar-reader-paused-token', !!options.paused);
    token.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    showMiniGloss(token, { fromTTS: true });
    ttsState.lastMarkedToken = token;
  }

  function markNextMatchingWord(word) {
    const key = normalizeWord(word);
    if (!key) return;

    const tokens = ttsState.tokens.length ? ttsState.tokens : collectReaderTokens();
    let index = tokens.findIndex((token, i) => i >= ttsState.tokenCursor && normalizeWord(token.dataset.word || token.textContent) === key);

    if (index < 0) {
      index = tokens.findIndex(token => normalizeWord(token.dataset.word || token.textContent) === key);
    }

    if (index >= 0) {
      ttsState.tokenCursor = index + 1;
      markTokenAsReading(tokens[index]);
    }
  }

  function resetStoryTTSState() {
    clearTimeout(ttsState.pauseTimer);
    ttsState.pauseTimer = null;
    ttsState.active = false;
    ttsState.paused = false;
    ttsState.sentenceIndex = 0;
    ttsState.tokenCursor = 0;
    ttsState.sentences = [];
    ttsState.tokens = [];
    ttsState.utterance = null;
    ttsState.lastMarkedToken = null;
    clearReadingMarks();
    hideMiniGloss();
    updateTTSButton();
  }

  function stopStoryTTS() {
    clearTimeout(ttsState.pauseTimer);
    ttsState.pauseTimer = null;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    resetStoryTTSState();
  }

  function speakNextSentence() {
    if (!ttsState.active || ttsState.paused) return;

    if (ttsState.sentenceIndex >= ttsState.sentences.length) {
      resetStoryTTSState();
      return;
    }

    const sentence = ttsState.sentences[ttsState.sentenceIndex];
    const utterance = new SpeechSynthesisUtterance(sentence);
    const voice = chooseUKVoice();

    utterance.lang = TTS_LANG;
    utterance.rate = TTS_RATE;
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      const firstWord = sentence.match(/[A-Za-z]+(?:['’-][A-Za-z]+)?/)?.[0] || '';
      if (firstWord) markNextMatchingWord(firstWord);
    };

    utterance.onboundary = event => {
      if (!ttsState.active || ttsState.paused) return;
      const word = wordAtBoundary(sentence, event.charIndex);
      if (word) markNextMatchingWord(word);
    };

    utterance.onerror = () => {
      resetStoryTTSState();
      safeToast('Reader audio stopped');
    };

    utterance.onend = () => {
      if (!ttsState.active || ttsState.paused) return;
      ttsState.sentenceIndex += 1;
      ttsState.pauseTimer = setTimeout(speakNextSentence, SENTENCE_PAUSE_MS);
    };

    ttsState.utterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  function startStoryTTS() {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      safeToast('Text to speech is not supported in this browser');
      return;
    }

    const text = getReaderTextForTTS();
    const sentences = splitSentences(text);
    if (!sentences.length) {
      safeToast('No Reader text to read');
      return;
    }

    window.speechSynthesis.cancel();
    clearReadingMarks();
    hideMiniGloss();
    closeFullReaderPanel();

    ttsState.active = true;
    ttsState.paused = false;
    ttsState.sentenceIndex = 0;
    ttsState.tokenCursor = 0;
    ttsState.sentences = sentences;
    ttsState.tokens = collectReaderTokens();
    ttsState.utterance = null;
    clearTimeout(ttsState.pauseTimer);
    ttsState.pauseTimer = null;

    updateTTSButton();
    speakNextSentence();
  }

  window.toggleWordJarReaderTTS = function toggleWordJarReaderTTS() {
    if (ttsState.active && ttsState.paused) {
      resumeStoryTTS(ttsState.lastMarkedToken);
      return;
    }
    if (ttsState.active) {
      stopStoryTTS();
      return;
    }
    startStoryTTS();
  };

  window.stopWordJarReaderTTS = stopStoryTTS;
  window.pauseWordJarReaderTTS = pauseStoryTTS;
  window.resumeWordJarReaderTTS = resumeStoryTTS;

  function enhanceReaderView() {
    injectStyles();
    patchSelectReaderWord();
    ensureTTSButton();
    bindReaderTokenDictionaryFix();
    bindOutsideClose();
    updateTTSButton();
  }

  function patchRenderHooks() {
    if (window.__wordjarReaderStoryTTSRenderHooksPatchedV3) return;
    window.__wordjarReaderStoryTTSRenderHooksPatchedV3 = true;

    const originalRenderReader = window.renderReader;
    window.renderReader = function renderReaderWithStoryTTS() {
      const result = typeof originalRenderReader === 'function' ? originalRenderReader.apply(this, arguments) : undefined;
      setTimeout(enhanceReaderView, 0);
      return result;
    };

    const originalRenderReaderTokens = window.renderReaderTokens;
    window.renderReaderTokens = function renderReaderTokensWithStoryTTS() {
      const result = typeof originalRenderReaderTokens === 'function' ? originalRenderReaderTokens.apply(this, arguments) : undefined;
      setTimeout(enhanceReaderView, 0);
      return result;
    };
  }

  function patchNavStop() {
    if (window.__wordjarReaderStoryTTSNavStopPatchedV3) return;
    const originalNav = window.nav;
    if (typeof originalNav !== 'function') return;
    window.__wordjarReaderStoryTTSNavStopPatchedV3 = true;

    window.nav = function navWithReaderTTSStop(page) {
      if (page !== 'reader' && ttsState.active) stopStoryTTS();
      if (page !== 'reader') hideMiniGloss();
      return originalNav.apply(this, arguments);
    };
  }

  function boot() {
    patchRenderHooks();
    patchNavStop();
    enhanceReaderView();
  }

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 250);

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => chooseUKVoice();
  }
})();
