// WordJar Performance Lite V2
// Adds dictionary pagination, debounced search, and per-word search text cache.

(function installWordJarPerformanceLite() {
  if (window.__wordjarPerformanceLiteInstalled) return;
  window.__wordjarPerformanceLiteInstalled = true;

  const PAGE_SIZE = 60;
  let visibleLimit = PAGE_SIZE;
  let lastSignature = '';
  let searchTimer = null;
  let deckNameCacheKey = '';
  let deckNameCache = new Map();
  const searchTextCache = new Map();

  const NO_DECK_ID = typeof SYSTEM_NO_DECK_ID !== 'undefined' ? SYSTEM_NO_DECK_ID : '__wordjar_system_no_deck__';
  const NO_DECK_NAME = typeof SYSTEM_NO_DECK_NAME !== 'undefined' ? SYSTEM_NO_DECK_NAME : 'No Deck';

  function safeText(value) {
    if (typeof escapeHTML === 'function') return escapeHTML(value);
    if (typeof escHTML === 'function') return escHTML(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function ensureFilters() {
    wordFilters = wordFilters || {};
    if (wordFilters.type === undefined) wordFilters.type = '';
    if (wordFilters.starred === undefined) wordFilters.starred = false;
    if (wordFilters.lang === undefined) wordFilters.lang = 'all';
    if (wordFilters.deck === undefined) wordFilters.deck = 'all';
    if (wordFilters.status === undefined) wordFilters.status = 'all';
    if (wordFilters.missing === undefined) wordFilters.missing = 'all';
    if (wordFilters.sort === undefined) wordFilters.sort = 'recent';
  }

  function getWordTypes(w) {
    if (w.__wjTypesCache && w.__wjTypesCacheRaw === w.type) return w.__wjTypesCache;
    const types = String(w.type || 'N').split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    w.__wjTypesCacheRaw = w.type;
    w.__wjTypesCache = types;
    return types;
  }

  function isNoDeck(deckId) {
    return String(deckId || '') === NO_DECK_ID;
  }

  function updateDeckNameCache() {
    const key = D.decks.map(d => `${d.id}:${d.name}`).join('|');
    if (key === deckNameCacheKey) return;
    deckNameCacheKey = key;
    deckNameCache = new Map();
    D.decks.forEach(d => deckNameCache.set(String(d.id), d.name));
    deckNameCache.set(NO_DECK_ID, NO_DECK_NAME);
    searchTextCache.clear();
  }

  function realDeckExists(deckId) {
    updateDeckNameCache();
    return deckNameCache.has(String(deckId));
  }

  function wordDeckName(deckId) {
    updateDeckNameCache();
    if (!deckId || isNoDeck(deckId) || !deckNameCache.has(String(deckId))) return NO_DECK_NAME;
    return deckNameCache.get(String(deckId)) || NO_DECK_NAME;
  }

  function wordStatus(w) {
    if (window.WordJarFSRS?.isDueCard) {
      const state = String(w.srsState || 'new');
      const due = WordJarFSRS.isDueCard(w);
      if (state === 'new') return 'new';
      if (state === 'learning' || state === 'relearning') return due ? 'learning' : 'scheduled';
      return due ? 'due' : 'review';
    }
    if ((w.reps || 0) === 0) return 'new';
    if (typeof isDue === 'function' && isDue(w)) return (w.interval || 1) < 21 ? 'learning' : 'due';
    return 'review';
  }

  function matchesMissing(w) {
    const m = wordFilters.missing || 'all';
    if (m === 'all') return true;
    if (m === 'pronunciation') return !String(w.pronunciation || '').trim();
    if (m === 'example') return !String(w.example || '').trim();
    if (m === 'notes') return !String(w.notes || '').trim();
    if (m === 'incomplete') return !String(w.pronunciation || '').trim() || !String(w.example || '').trim() || !String(w.meaning || '').trim();
    return true;
  }

  function wordCacheSignature(w) {
    return [
      w.word, w.meaning, w.pronunciation, w.example, w.notes,
      Array.isArray(w.synonyms) ? w.synonyms.join('|') : w.synonyms,
      w.level, w.type, w.deckId, w.lang, w.srsState, w.reps, w.nextReview, w.dueAt, w.starred
    ].join('§');
  }

  function getSearchText(w) {
    const id = String(w.id || w.word || Math.random());
    const sig = wordCacheSignature(w);
    const cached = searchTextCache.get(id);
    if (cached && cached.sig === sig) return cached.text;

    const deckName = wordDeckName(w.deckId);
    const lang = String(w.lang || 'en').toLowerCase();
    const status = wordStatus(w);
    const text = [w.word, w.meaning, w.pronunciation, w.example, w.notes, w.synonyms, w.level, w.type, deckName, lang, status]
      .join(' ')
      .toLowerCase();
    searchTextCache.set(id, { sig, text });
    return text;
  }

  function getFilteredWords() {
    ensureFilters();
    updateDeckNameCache();
    const q = (document.getElementById('si')?.value || '').trim().toLowerCase();
    let list = D.words.filter(w => {
      const types = getWordTypes(w);
      const lang = String(w.lang || 'en').toLowerCase();
      const status = wordStatus(w);

      if (q && !getSearchText(w).includes(q)) return false;
      if (wordFilters.starred && !w.starred) return false;
      if (wordFilters.type && !types.includes(wordFilters.type)) return false;
      if (wordFilters.lang !== 'all' && lang !== wordFilters.lang) return false;
      if (wordFilters.deck === NO_DECK_ID && realDeckExists(w.deckId)) return false;
      if (wordFilters.deck && wordFilters.deck !== 'all' && wordFilters.deck !== NO_DECK_ID && String(w.deckId) !== String(wordFilters.deck)) return false;
      if (wordFilters.status !== 'all' && status !== wordFilters.status) return false;
      if (!matchesMissing(w)) return false;
      return true;
    });

    const sort = wordFilters.sort || 'recent';
    if (sort === 'az') list.sort((a, b) => String(a.word || '').localeCompare(String(b.word || '')));
    else if (sort === 'deck') list.sort((a, b) => wordDeckName(a.deckId).localeCompare(wordDeckName(b.deckId)) || String(a.word || '').localeCompare(String(b.word || '')));
    else if (sort === 'due') list.sort((a, b) => new Date(a.dueAt || a.nextReview || 0) - new Date(b.dueAt || b.nextReview || 0));
    else list = list.slice().reverse();

    return list;
  }

  function signature() {
    const q = document.getElementById('si')?.value || '';
    return JSON.stringify({ q, f: wordFilters, n: D.words.length, d: deckNameCacheKey });
  }

  function wordRow(w) {
    const types = getWordTypes(w);
    const typeDisplay = types[0] || 'N';
    const pron = w.pronunciation ? `<div class="wpn">${safeText(w.pronunciation)}</div>` : '';
    const status = wordStatus(w);
    const statusLabel = { new:'New', learning:'Learning', due:'Due', review:'Review', scheduled:'Scheduled' }[status] || status;

    return `
      <div class="wr" onclick="showDetail('${safeText(w.id)}')">
        <div class="wm">
          <div class="wen">${safeText(w.word)}</div>
          ${pron}
          <div class="wth">${safeText(w.meaning)}</div>
          <div class="wpn" style="margin-top:6px;">${safeText(wordDeckName(w.deckId))} · ${safeText(statusLabel)}</div>
        </div>
        <div class="wr-right">
          <span class="tt">${safeText(typeDisplay)}</span>
          <button class="star-btn ${w.starred ? 'on' : ''}" onclick="event.stopPropagation(); toggleStar('${safeText(w.id)}')">
            <svg viewBox="0 0 24 24" fill="${w.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  function injectStyles() {
    if (document.getElementById('performanceLiteStyle')) return;
    const style = document.createElement('style');
    style.id = 'performanceLiteStyle';
    style.textContent = `
      .dict-load-more-wrap { padding: 8px 20px 24px; }
      .dict-load-more-note { color:var(--ink2); font-size:12px; font-weight:800; text-align:center; margin-bottom:8px; }
    `;
    document.head.appendChild(style);
  }

  window.loadMoreWords = function loadMoreWords() {
    visibleLimit += PAGE_SIZE;
    renderWords();
  };

  const previousUpdateSummary = window.updateWordFilterSummary || window.renderWordFilterUI || null;

  window.renderWords = function renderWordsPaginated() {
    ensureFilters();
    injectStyles();
    updateDeckNameCache();
    const el = document.getElementById('wordList');
    if (!el) return;

    const sig = signature();
    if (sig !== lastSignature) {
      visibleLimit = PAGE_SIZE;
      lastSignature = sig;
    }

    if (typeof previousUpdateSummary === 'function') previousUpdateSummary();

    const list = getFilteredWords();
    const shown = list.slice(0, visibleLimit);

    if (!shown.length) {
      el.innerHTML = `<div class="empty"><div class="empty-title">No words found</div><div class="empty-sub">Try another keyword or loosen filters.</div></div>`;
      return;
    }

    const more = list.length > shown.length
      ? `<div class="dict-load-more-wrap"><div class="dict-load-more-note">Showing ${shown.length} of ${list.length}</div><button class="btn btn-s btn-full" type="button" onclick="loadMoreWords()">Load more</button></div>`
      : `<div class="dict-load-more-wrap"><div class="dict-load-more-note">Showing ${shown.length} of ${list.length}</div></div>`;

    el.innerHTML = shown.map(wordRow).join('') + more;
  };

  function installSearchDebounce() {
    const input = document.getElementById('si');
    if (!input || input.__wordjarDebouncedSearch) return;
    input.removeAttribute('oninput');
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderWords(), 180);
    });
    input.__wordjarDebouncedSearch = true;
  }

  const originalNav = window.nav;
  window.nav = function navWithPerformanceLite(page) {
    if (typeof originalNav === 'function') originalNav(page);
    if (page === 'words') {
      setTimeout(() => {
        installSearchDebounce();
        renderWords();
      }, 0);
    }
  };

  window.WordJarDictionaryPerformance = {
    clearCache: () => searchTextCache.clear(),
    cacheSize: () => searchTextCache.size
  };

  setTimeout(() => {
    installSearchDebounce();
    if (curPage === 'words') renderWords();
  }, 0);
})();
