// WordJar App Integrity V2
// Repairs common local data issues safely before they become UI/performance bugs.
// Local-only. No network. No paid service.

(function installAppIntegrity() {
  if (window.__wordjarAppIntegrityInstalled) return;
  window.__wordjarAppIntegrityInstalled = true;

  const NO_DECK_ID = typeof SYSTEM_NO_DECK_ID !== 'undefined' ? SYSTEM_NO_DECK_ID : '__wordjar_system_no_deck__';
  const DEFAULT_DECK_OPTIONS = {
    newPerDay: 25,
    revPerDay: 999,
    ignoreRev: false,
    limitsTop: false,
    learnSteps: '1m 10m',
    insertOrder: 'seq',
    reLearnSteps: '10m',
    leechThresh: 8,
    leechAction: 'tag'
  };

  function ensureArrays() {
    let changed = false;
    if (!Array.isArray(D.decks)) { D.decks = []; changed = true; }
    if (!Array.isArray(D.words)) { D.words = []; changed = true; }
    if (!Array.isArray(D.reviewLog)) { D.reviewLog = []; changed = true; }
    if (!D.studyDays || typeof D.studyDays !== 'object') { D.studyDays = {}; changed = true; }
    if (!D.settings || typeof D.settings !== 'object') { D.settings = {}; changed = true; }
    return changed;
  }

  function stableId(prefix) {
    return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeDecks() {
    let changed = false;
    const seen = new Set();

    D.decks.forEach(deck => {
      if (!deck.id || seen.has(String(deck.id)) || String(deck.id) === NO_DECK_ID) {
        deck.id = stableId('d');
        changed = true;
      }
      seen.add(String(deck.id));

      if (!String(deck.name || '').trim()) {
        deck.name = 'Untitled Deck';
        changed = true;
      }

      if (!deck.options || typeof deck.options !== 'object') {
        deck.options = { ...DEFAULT_DECK_OPTIONS };
        changed = true;
      } else {
        Object.keys(DEFAULT_DECK_OPTIONS).forEach(key => {
          if (deck.options[key] === undefined || deck.options[key] === null || deck.options[key] === '') {
            deck.options[key] = DEFAULT_DECK_OPTIONS[key];
            changed = true;
          }
        });
      }
    });

    return changed;
  }

  function parseSynonyms(value) {
    const parts = Array.isArray(value) ? value : [value];
    return [...new Set(parts
      .flatMap(item => String(item || '').split(/[,;|/]+/))
      .map(item => item.trim())
      .filter(Boolean))];
  }

  function normalizeWords() {
    let changed = false;
    const deckIds = new Set(D.decks.map(d => String(d.id)));
    const seen = new Set();

    D.words.forEach(word => {
      if (!word.id || seen.has(String(word.id))) {
        word.id = stableId('w');
        changed = true;
      }
      seen.add(String(word.id));

      if (!String(word.word || '').trim()) {
        word.word = 'untitled';
        changed = true;
      }
      word.word = String(word.word).trim();

      if (!word.deckId || (!deckIds.has(String(word.deckId)) && String(word.deckId) !== NO_DECK_ID)) {
        word.deckId = NO_DECK_ID;
        changed = true;
      }

      if (!word.type) { word.type = 'N'; changed = true; }
      if (!word.lang) { word.lang = 'en'; changed = true; }
      if (typeof word.starred !== 'boolean') { word.starred = !!word.starred; changed = true; }

      const syns = parseSynonyms(word.synonyms || word.synonym || '');
      if (word.synonym !== undefined) {
        delete word.synonym;
        changed = true;
      }
      const currentSyns = parseSynonyms(word.synonyms || '');
      if (JSON.stringify(currentSyns) !== JSON.stringify(syns)) {
        word.synonyms = syns;
        changed = true;
      }

      if (!word.srsState) {
        word.srsState = (Number(word.reps || 0) > 0 || word.nextReview || word.dueAt) ? 'review' : 'new';
        changed = true;
      }
      if (word.reps === undefined || word.reps === null) { word.reps = 0; changed = true; }
      if (word.interval === undefined || word.interval === null) { word.interval = Number(word.scheduledDays || 0) || 0; changed = true; }
      if (word.scheduledDays === undefined || word.scheduledDays === null) { word.scheduledDays = Number(word.interval || 0) || 0; changed = true; }
      if (word.lapses === undefined || word.lapses === null) { word.lapses = 0; changed = true; }
    });

    return changed;
  }

  function normalizeSettings() {
    let changed = false;
    D.settings = D.settings || {};
    if (D.settings.showSystemNoDeck === undefined) { D.settings.showSystemNoDeck = true; changed = true; }
    if (!D.settings.dashboard || typeof D.settings.dashboard !== 'object') { D.settings.dashboard = {}; changed = true; }
    if (!D.settings.flashcardDisplay || typeof D.settings.flashcardDisplay !== 'object') { D.settings.flashcardDisplay = {}; changed = true; }
    return changed;
  }

  function clearRuntimeCaches() {
    if (window.WordJarDictionaryPerformance?.clearCache) WordJarDictionaryPerformance.clearCache();
    if (window.WordJarDeckPerformance?.clearCache) WordJarDeckPerformance.clearCache();
    if (window.WordJarDashboardStats?.clearStatsCache) WordJarDashboardStats.clearStatsCache();
    if (window.WordJarHomePerformance?.clearCache) WordJarHomePerformance.clearCache();
    if (window.WordJarCalendarPerformance?.clearCache) WordJarCalendarPerformance.clearCache();
  }

  function runIntegrity(options = {}) {
    const silent = options.silent !== false;
    let changed = false;
    changed = ensureArrays() || changed;
    changed = normalizeDecks() || changed;
    changed = normalizeWords() || changed;
    changed = normalizeSettings() || changed;

    if (changed) {
      clearRuntimeCaches();
      save();
      if (!silent && typeof toast === 'function') toast('App data repaired');
    }
    return { changed, words: D.words.length, decks: D.decks.length };
  }

  window.WordJarAppIntegrity = {
    run: runIntegrity,
    clearRuntimeCaches,
    parseSynonyms
  };

  if ('requestIdleCallback' in window) requestIdleCallback(() => runIntegrity({ silent: true }), { timeout: 2500 });
  else setTimeout(() => runIntegrity({ silent: true }), 1200);
})();
