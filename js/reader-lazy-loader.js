// WordJar Reader Lazy Loader V12
// Loads Reader once. Optional Reader modules are allowed to fail so a missing add-on file
// cannot trap the app on the Reader loading state.

(function installReaderLazyLoader() {
  if (window.__wordjarReaderLazyLoaderInstalledV12) return;
  window.__wordjarReaderLazyLoaderInstalledV12 = true;

  let readerLoadPromise = null;

  function injectReaderButton() {
    if (document.getElementById('tb-reader')) return;
    const wordsBtn = document.getElementById('tb-words');
    if (!wordsBtn) return;

    const btn = document.createElement('button');
    btn.className = 'top-btn';
    btn.id = 'tb-reader';
    btn.type = 'button';
    btn.onclick = () => nav('reader');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 014 16.5v-11z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>`;
    wordsBtn.insertAdjacentElement('afterend', btn);
  }

  function markReaderLoading() {
    document.querySelectorAll('.top-btn').forEach(n => n.classList.remove('active'));
    const btn = document.getElementById('tb-reader');
    if (btn) btn.classList.add('active');
    if (typeof toast === 'function') toast('Loading Reader...');
  }

  function mountReaderExtras() {
    if (window.WordJarReaderFormatNovel?.mount) {
      WordJarReaderFormatNovel.mount();
    }
  }

  function rebindReaderAI() {
    if (window.WordJarHighEndAI?.runReaderSmartAnalysis) {
      window.runReaderSmartAnalysis = window.WordJarHighEndAI.runReaderSmartAnalysis;
      const btn = document.getElementById('wordjarReaderAIAnalyzeBtn');
      if (btn) btn.onclick = window.WordJarHighEndAI.runReaderSmartAnalysis;
    }
  }

  function captureEnhancedReaderSelect() {
    if (typeof window.selectReaderWord === 'function') {
      window.__wordjarReaderBaseSelectReaderWord = window.selectReaderWord;
      window.__wordjarSingleTapOriginalSelectReaderWord = window.selectReaderWord;
    }
  }

  function loadRequiredModule(src) {
    return loadWordJarModule(src);
  }

  function loadOptionalModule(src) {
    return loadWordJarModule(src).catch(err => {
      console.warn(`Optional Reader module failed to load: ${src}`, err);
    });
  }

  function loadReaderEnhancementsChain() {
    return loadOptionalModule('js/reader-notes-rich-handoff-fix.js')
      .then(() => loadOptionalModule('js/reader-enhancements.js'))
      .then(captureEnhancedReaderSelect)
      .then(() => loadOptionalModule('js/reader-story-tts-fix.js'))
      .then(() => loadOptionalModule('js/reader-autoplay-popup.js'))
      .then(() => loadOptionalModule('js/reader-tts-gloss-position-fix.js'))
      .then(() => loadOptionalModule('js/reader-speaking-token-frame-fix.js'))
      .then(() => loadOptionalModule('js/reader-single-tap-panel-fix.js'))
      .then(() => loadOptionalModule('js/reader-mobile-rich-clear-panel-fix.js'))
      .then(() => loadOptionalModule('js/reader-smart-analysis.js'))
      .then(rebindReaderAI);
  }

  function loadReaderModules() {
    if (window.renderReader && document.getElementById('pg-reader') && window.WordJarReaderFormatNovel?.mount) {
      mountReaderExtras();
      loadReaderEnhancementsChain();
      return Promise.resolve();
    }
    if (readerLoadPromise) return readerLoadPromise;

    readerLoadPromise = Promise.resolve()
      .then(() => loadRequiredModule('js/reader.js'))
      .then(() => loadOptionalModule('js/reader-enhancements.js'))
      .then(captureEnhancedReaderSelect)
      .then(() => loadOptionalModule('js/reader-quality.js'))
      .then(() => loadOptionalModule('js/reader-performance.js'))
      .then(() => loadOptionalModule('js/reader-process-mode.js'))
      .then(() => loadOptionalModule('js/reader-notes-core-v2.js'))
      .then(() => loadOptionalModule('js/reader-notes-rich-handoff-fix.js'))
      .then(() => loadOptionalModule('js/reader-story-tts-fix.js'))
      .then(() => loadOptionalModule('js/reader-autoplay-popup.js'))
      .then(() => loadOptionalModule('js/reader-tts-gloss-position-fix.js'))
      .then(() => loadOptionalModule('js/reader-speaking-token-frame-fix.js'))
      .then(() => loadOptionalModule('js/reader-single-tap-panel-fix.js'))
      .then(() => loadOptionalModule('js/reader-mobile-rich-clear-panel-fix.js'))
      .then(() => loadOptionalModule('js/reader-smart-analysis.js'))
      .then(rebindReaderAI)
      .then(() => loadOptionalModule('js/reader-format-novel.js'))
      .then(mountReaderExtras)
      .catch(err => {
        readerLoadPromise = null;
        throw err;
      });

    return readerLoadPromise;
  }

  function openReaderPage() {
    document.querySelectorAll('.page, .study-page').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.top-btn').forEach(n => n.classList.remove('active'));

    const reader = document.getElementById('pg-reader');
    if (reader) reader.classList.add('active');
    const btn = document.getElementById('tb-reader');
    if (btn) btn.classList.add('active');
    const header = document.getElementById('mainHeader');
    if (header) header.style.display = 'flex';

    curPage = 'reader';
    if (typeof renderReader === 'function') renderReader();
    mountReaderExtras();
    setTimeout(rebindReaderAI, 0);
    setTimeout(() => window.WordJarReaderAutoplayPopup?.refresh?.(), 0);
  }

  const originalNav = window.nav;
  window.nav = function navWithLazyReader(page) {
    if (page !== 'reader') {
      if (typeof originalNav === 'function') originalNav(page);
      return;
    }

    injectReaderButton();
    markReaderLoading();
    loadReaderModules()
      .then(openReaderPage)
      .catch(err => {
        console.warn('Reader failed to load', err);
        if (typeof toast === 'function') toast('Reader failed to load');
      });
  };

  injectReaderButton();
})();
