// WordJar Reader Performance V2
// Debounces Reader text rendering/saving after Reader has been loaded.
// Captures input before older Reader handlers so long notes do not save/render on every keystroke.

(function installReaderPerformance() {
  if (window.__wordjarReaderPerformanceInstalled) return;
  window.__wordjarReaderPerformanceInstalled = true;

  let timer = null;
  const STORAGE_KEY = 'wordjar_reader_note_v1';

  function renderTokensOnly() {
    if (typeof window.renderReaderTokens === 'function') {
      window.renderReaderTokens();
      return;
    }

    const input = document.getElementById('readerInput');
    const tokensEl = document.getElementById('readerTokens');
    const countEl = document.getElementById('readerCount');
    if (!input || !tokensEl) return;

    const tokens = String(input.value || '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)?|\d+|[^A-Za-z\d]+/g) || [];
    const wordCount = tokens.filter(t => /^[A-Za-z]+(?:['’-][A-Za-z]+)?$/.test(t)).length;
    if (countEl) countEl.textContent = `${wordCount} word${wordCount === 1 ? '' : 's'}`;
  }

  function bindReaderInputDebounced() {
    const input = document.getElementById('readerInput');
    if (!input || input.__wordjarReaderPerformanceBound) return;

    input.__wordjarReaderPerformanceBound = true;
    input.addEventListener('input', event => {
      event.stopImmediatePropagation();
      clearTimeout(timer);
      timer = setTimeout(() => {
        D.reader = D.reader || {};
        D.reader.text = input.value;
        localStorage.setItem(STORAGE_KEY, input.value);
        save();
        renderTokensOnly();
      }, 450);
    }, true);
  }

  const originalRenderReader = window.renderReader;
  window.renderReader = function renderReaderWithDebouncedInput() {
    if (typeof originalRenderReader === 'function') originalRenderReader();
    bindReaderInputDebounced();
  };

  setTimeout(bindReaderInputDebounced, 0);
})();
