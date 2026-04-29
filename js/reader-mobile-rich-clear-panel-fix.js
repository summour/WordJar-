// WordJar Reader Mobile Rich Clear Panel Fix V1
// Fixes two Reader mobile issues:
// 1) Clear must remove rich-note Reader View, not only the hidden plain textarea.
// 2) Word detail panel must stay visible and tappable after Reader audio is opened.

(function installWordJarReaderMobileRichClearPanelFix() {
  if (window.__wordjarReaderMobileRichClearPanelFixInstalledV1) return;
  window.__wordjarReaderMobileRichClearPanelFixInstalledV1 = true;

  const STYLE_ID = 'wordjarReaderMobileRichClearPanelFixStyle';
  const RICH_HTML_KEY = 'wordjar_reader_note_html_v1';
  const RICH_NOTE_ID_KEY = 'wordjar_reader_active_note_id_v1';
  const PLAIN_TEXT_KEY = 'wordjar_reader_note_v1';
  const RICH_SOURCE_ID = 'wordjarReaderRichSource';
  const RICH_ACTIVE_CLASS = 'wordjar-reader-rich-active';

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .reader-panel.open {
        z-index: 900;
        pointer-events: auto;
      }

      @media (max-width: 640px) {
        .reader-panel.open {
          position: fixed;
          left: max(14px, env(safe-area-inset-left, 0px));
          right: max(14px, env(safe-area-inset-right, 0px));
          bottom: max(14px, env(safe-area-inset-bottom, 0px));
          max-height: min(62vh, 430px);
          overflow: auto;
          margin: 0;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
        }

        #readerTokens .reader-token,
        #readerTokens .reader-token.known {
          touch-action: manipulation;
          pointer-events: auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function resetRichReaderState() {
    if (window.stopWordJarReaderTTS) window.stopWordJarReaderTTS();

    D.reader = D.reader || {};
    D.reader.text = '';
    D.reader.html = '';
    D.reader.richNote = false;
    D.reader.activeNoteId = '';

    localStorage.removeItem(PLAIN_TEXT_KEY);
    localStorage.removeItem(RICH_HTML_KEY);
    localStorage.removeItem(RICH_NOTE_ID_KEY);

    const input = document.getElementById('readerInput');
    if (input) {
      input.value = '';
      input.classList.remove('wordjar-reader-rich-hidden');
    }

    document.getElementById(RICH_SOURCE_ID)?.remove();
    document.getElementById('pg-reader')?.classList.remove(RICH_ACTIVE_CLASS);
    document.getElementById('wordjarReaderMiniGloss')?.classList.remove('open');

    const count = document.getElementById('readerCount');
    if (count) count.textContent = '0 words';

    const tokens = document.getElementById('readerTokens');
    if (tokens) tokens.innerHTML = '<div class="reader-empty">Your interactive text will appear here.</div>';

    if (window.closeReaderPanel) window.closeReaderPanel();
    if (typeof save === 'function') save();
  }

  function patchClearReaderText() {
    if (window.__wordjarMobileRichClearPatchedV1) return;
    if (typeof window.clearReaderText !== 'function') return;

    window.__wordjarMobileRichClearPatchedV1 = true;

    window.clearReaderText = function clearReaderTextMobileRichSafe() {
      const hasPlainText = !!String(document.getElementById('readerInput')?.value || '').trim();
      const hasRichText = !!String(D?.reader?.html || localStorage.getItem(RICH_HTML_KEY) || '').trim();

      if ((hasPlainText || hasRichText) && !confirm('Clear reader text?')) return;
      resetRichReaderState();
    };
  }

  function keepPanelInView() {
    const panel = document.getElementById('readerPanel');
    if (!panel?.classList.contains('open')) return;

    requestAnimationFrame(() => {
      if (!panel.classList.contains('open')) return;
      panel.scrollTop = 0;
    });
  }

  function patchSelectReaderWord() {
    if (window.__wordjarMobilePanelSelectPatchedV1) return;
    if (typeof window.selectReaderWord !== 'function') return;

    const original = window.selectReaderWord;
    window.__wordjarMobilePanelSelectPatchedV1 = true;

    window.selectReaderWord = function selectReaderWordMobilePanelSafe(token) {
      const result = original.apply(this, arguments);
      keepPanelInView();
      return result;
    };
  }

  function boot() {
    injectStyles();
    patchClearReaderText();
    patchSelectReaderWord();
  }

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 300);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
})();
