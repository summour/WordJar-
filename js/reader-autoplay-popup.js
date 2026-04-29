// WordJar Reader Speaking Frame V3
// Highlights the spoken Reader word with a small frame only. No popup and no page jumping.
(function installWordJarReaderSpeakingFrame() {
  if (window.__wordjarReaderSpeakingFrameInstalledV3) return;
  window.__wordjarReaderSpeakingFrameInstalledV3 = true;

  const STYLE_ID = 'wordjarReaderSpeakingFrameStyle';
  const WORD_RE = /[A-Za-z]+(?:['’-][A-Za-z]+)?/g;

  const state = {
    words: [],
    cursor: 0,
    lastToken: null
  };

  function isReaderPage() {
    return window.curPage === 'reader' || !!document.querySelector('#pg-reader.active');
  }

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #wordjarReaderAutoplayPopup,
      .wordjar-reader-auto-popup {
        display: none;
      }

      #readerTokens .reader-token.wordjar-reader-auto-speaking {
        background: rgba(17, 17, 17, 0.035);
        box-shadow: 0 0 0 1.5px rgba(17, 17, 17, 0.22) inset;
        border-radius: 7px;
        padding: 0 2px;
        margin: 0 -2px;
        transition: background 0.12s ease, box-shadow 0.12s ease;
      }

      @media (max-width: 430px) {
        #readerTokens .reader-token.wordjar-reader-auto-speaking {
          box-shadow: 0 0 0 1.25px rgba(17, 17, 17, 0.22) inset;
          border-radius: 6px;
          padding: 0 1px;
          margin: 0 -1px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function normalizeWord(value) {
    return String(value || '').toLowerCase().replace(/^['’]+|['’]+$/g, '').trim();
  }

  function getSpokenWord(text, charIndex) {
    const source = String(text || '');
    const index = Math.max(0, Number(charIndex || 0));
    const after = source.slice(index).match(/[A-Za-z]+(?:['’-][A-Za-z]+)?/);
    if (after) return after[0];
    const before = source.slice(0, index + 1).match(/[A-Za-z]+(?:['’-][A-Za-z]+)?$/);
    return before ? before[0] : '';
  }

  function collectTokens() {
    const tokens = Array.from(document.querySelectorAll('#readerTokens .reader-token'));
    state.words = tokens
      .map(token => ({
        token,
        key: normalizeWord(token.dataset.word || token.textContent || '')
      }))
      .filter(item => item.key);
  }

  function findToken(word) {
    const key = normalizeWord(word);
    if (!key) return null;
    if (!state.words.length) collectTokens();

    for (let i = state.cursor; i < state.words.length; i += 1) {
      if (state.words[i].key === key) {
        state.cursor = i + 1;
        return state.words[i].token;
      }
    }

    for (let i = 0; i < state.cursor; i += 1) {
      if (state.words[i].key === key) {
        state.cursor = i + 1;
        return state.words[i].token;
      }
    }

    return null;
  }

  function clearActiveToken() {
    if (state.lastToken) state.lastToken.classList.remove('wordjar-reader-auto-speaking');
    state.lastToken = null;
  }

  function markToken(token) {
    if (!token) return;
    clearActiveToken();
    state.lastToken = token;
    token.classList.add('wordjar-reader-auto-speaking');
  }

  function handleBoundary(event, utterance) {
    if (!isReaderPage()) return;
    const word = getSpokenWord(utterance?.text || '', event?.charIndex || 0);
    const token = findToken(word);
    if (token) markToken(token);
  }

  function patchSpeechSynthesis() {
    if (!window.speechSynthesis || window.__wordjarReaderSpeakingFrameSpeakPatched) return;
    window.__wordjarReaderSpeakingFrameSpeakPatched = true;

    const synth = window.speechSynthesis;
    const originalSpeak = synth.speak.bind(synth);
    const originalCancel = synth.cancel.bind(synth);
    const originalPause = synth.pause ? synth.pause.bind(synth) : null;

    synth.speak = function speakWithReaderFrame(utterance) {
      if (isReaderPage() && utterance instanceof SpeechSynthesisUtterance && !utterance.__wordjarReaderFrameAttached) {
        utterance.__wordjarReaderFrameAttached = true;
        collectTokens();

        const originalBoundary = utterance.onboundary;
        const originalStart = utterance.onstart;
        const originalEnd = utterance.onend;
        const originalError = utterance.onerror;

        utterance.onstart = function readerFrameStart(event) {
          collectTokens();
          const firstWord = String(utterance.text || '').match(WORD_RE)?.[0] || '';
          const token = findToken(firstWord);
          if (token) markToken(token);
          if (typeof originalStart === 'function') originalStart.call(this, event);
        };

        utterance.onboundary = function readerFrameBoundary(event) {
          if (event && typeof event.charIndex === 'number') handleBoundary(event, utterance);
          if (typeof originalBoundary === 'function') originalBoundary.call(this, event);
        };

        utterance.onend = function readerFrameEnd(event) {
          clearActiveToken();
          if (typeof originalEnd === 'function') originalEnd.call(this, event);
        };

        utterance.onerror = function readerFrameError(event) {
          clearActiveToken();
          if (typeof originalError === 'function') originalError.call(this, event);
        };
      }

      return originalSpeak(utterance);
    };

    synth.cancel = function cancelWithReaderFrame() {
      clearActiveToken();
      return originalCancel();
    };

    if (originalPause) {
      synth.pause = function pauseWithReaderFrame() {
        clearActiveToken();
        return originalPause();
      };
    }
  }

  function removeOldPopup() {
    document.getElementById('wordjarReaderAutoplayPopup')?.remove();
  }

  function boot() {
    injectStyles();
    removeOldPopup();
    patchSpeechSynthesis();
  }

  window.WordJarReaderAutoplayPopup = {
    refresh: collectTokens,
    hide: clearActiveToken
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearActiveToken();
  });

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 300);
})();
