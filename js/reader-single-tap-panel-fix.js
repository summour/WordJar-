// WordJar Reader Single Tap Panel Fix V3
// Single owner for Reader word tap: tap once opens the full Reader panel. Mini gloss is suppressed.

(function installWordJarReaderSingleTapPanelFix() {
  if (window.__wordjarReaderSingleTapPanelFixInstalledV3) return;
  window.__wordjarReaderSingleTapPanelFixInstalledV3 = true;

  const STYLE_ID = 'wordjarReaderSingleTapPanelFixStyle';
  const MINI_GLOSS_ID = 'wordjarReaderMiniGloss';
  let openingPanel = false;

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #readerTokens .reader-token.wordjar-reader-mini-active {
        background: transparent;
        box-shadow: none;
      }

      #${MINI_GLOSS_ID} {
        display: none;
        opacity: 0;
        pointer-events: none;
      }

      #readerTokens .reader-token.active,
      #readerTokens .reader-token.wordjar-reader-panel-active {
        display: inline-block;
        padding: 3px 10px;
        margin: 0 2px;
        border-radius: 18px;
        background: #fafafa;
        box-shadow:
          0 0 0 1.5px #d8d8d8 inset,
          0 1px 2px rgba(0, 0, 0, 0.04);
        vertical-align: baseline;
        line-height: inherit;
      }
    `;

    document.head.appendChild(style);
  }

  function safeWord(token) {
    return String(token?.dataset?.word || token?.textContent || '').trim();
  }

  function hideMiniGloss() {
    const gloss = document.getElementById(MINI_GLOSS_ID);
    if (gloss) {
      gloss.classList.remove('open');
      gloss.style.display = 'none';
    }
    document.querySelectorAll('#readerTokens .wordjar-reader-mini-active')
      .forEach(token => token.classList.remove('wordjar-reader-mini-active'));
  }

  function pauseReaderAudio() {
    if (typeof window.pauseWordJarReaderTTS === 'function') {
      window.pauseWordJarReaderTTS();
      return;
    }
    if (window.speechSynthesis?.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    }
  }

  function markToken(token) {
    document.querySelectorAll('#readerTokens .reader-token.active, #readerTokens .wordjar-reader-panel-active')
      .forEach(item => item.classList.remove('active', 'wordjar-reader-panel-active'));
    token.classList.add('active', 'wordjar-reader-panel-active');
  }

  function getBaseSelectReaderWord() {
    if (typeof window.__wordjarReaderBaseSelectReaderWord === 'function') {
      return window.__wordjarReaderBaseSelectReaderWord;
    }
    if (typeof window.__wordjarSingleTapOriginalSelectReaderWord === 'function') {
      return window.__wordjarSingleTapOriginalSelectReaderWord;
    }
    return null;
  }

  function openPanelForToken(token) {
    const word = safeWord(token);
    const baseSelect = getBaseSelectReaderWord();
    if (!word || openingPanel || typeof baseSelect !== 'function') return;

    hideMiniGloss();
    pauseReaderAudio();
    markToken(token);

    openingPanel = true;
    try {
      baseSelect.call(window, token);
      markToken(token);
      setTimeout(() => {
        if (window.WordJarReaderSmartAnalysis?.enhancePanel) window.WordJarReaderSmartAnalysis.enhancePanel(word);
        if (window.WordJarHighEndAI?.runReaderSmartAnalysis) {
          const btn = document.getElementById('wordjarReaderAIAnalyzeBtn');
          if (btn) btn.onclick = window.WordJarHighEndAI.runReaderSmartAnalysis;
        }
      }, 0);
    } finally {
      openingPanel = false;
    }
  }

  function handleSingleTap(event) {
    const token = event.target?.closest?.('#readerTokens .reader-token');
    if (!token) return;
    if (!document.getElementById('pg-reader')?.classList.contains('active')) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openPanelForToken(token);
  }

  function patchSelectReaderWord() {
    if (window.__wordjarSingleTapSelectReaderWordPatchedV3) return;
    if (typeof window.selectReaderWord !== 'function') return;

    if (!window.__wordjarReaderBaseSelectReaderWord) {
      window.__wordjarReaderBaseSelectReaderWord = window.__wordjarSingleTapOriginalSelectReaderWord || window.selectReaderWord;
    }

    window.__wordjarSingleTapSelectReaderWordPatchedV3 = true;
    window.__wordjarSingleTapOriginalSelectReaderWord = window.__wordjarReaderBaseSelectReaderWord;

    window.selectReaderWord = function selectReaderWordOpenFullPanel(token) {
      if (token?.classList?.contains('reader-token')) {
        openPanelForToken(token);
        return;
      }
      return window.__wordjarReaderBaseSelectReaderWord.apply(this, arguments);
    };
  }

  function patchCloseReaderPanel() {
    if (window.__wordjarSingleTapClosePanelPatchedV3) return;
    if (typeof window.closeReaderPanel !== 'function') return;

    const original = window.closeReaderPanel;
    window.__wordjarSingleTapClosePanelPatchedV3 = true;

    window.closeReaderPanel = function closeReaderPanelSingleTapClean() {
      const result = original.apply(this, arguments);
      document.querySelectorAll('#readerTokens .wordjar-reader-panel-active')
        .forEach(token => token.classList.remove('wordjar-reader-panel-active'));
      hideMiniGloss();
      return result;
    };
  }

  function boot() {
    injectStyles();
    hideMiniGloss();
    patchSelectReaderWord();
    patchCloseReaderPanel();
  }

  document.addEventListener('click', handleSingleTap, true);
  document.addEventListener('touchend', event => {
    const token = event.target?.closest?.('#readerTokens .reader-token');
    if (!token) return;
    handleSingleTap(event);
  }, { capture: true, passive: false });

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 300);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
})();
