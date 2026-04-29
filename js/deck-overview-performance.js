// WordJar Deck Overview Performance V1
// Uses the single-pass deck stats cache for Deck Overview instead of rescanning a deck repeatedly.

(function installDeckOverviewPerformance() {
  if (window.__wordjarDeckOverviewPerformanceInstalled) return;
  window.__wordjarDeckOverviewPerformanceInstalled = true;

  const NO_DECK_ID = typeof SYSTEM_NO_DECK_ID !== 'undefined' ? SYSTEM_NO_DECK_ID : '__wordjar_system_no_deck__';
  const NO_DECK_NAME = typeof SYSTEM_NO_DECK_NAME !== 'undefined' ? SYSTEM_NO_DECK_NAME : 'No Deck';

  function isNoDeck(deckId) {
    return String(deckId || '') === NO_DECK_ID;
  }

  function realDeck(deckId) {
    return D.decks.find(d => String(d.id) === String(deckId));
  }

  function wordsForDeck(deckId) {
    if (isNoDeck(deckId)) return D.words.filter(w => isNoDeck(w.deckId) || !realDeck(w.deckId));
    return D.words.filter(w => String(w.deckId || '') === String(deckId));
  }

  function fallbackStats(deckId) {
    let newC = 0, lrnC = 0, dueC = 0;
    wordsForDeck(deckId).forEach(w => {
      const state = String(w.srsState || ((w.reps || 0) > 0 || w.nextReview ? 'review' : 'new'));
      const due = window.WordJarFSRS?.isDueCard ? WordJarFSRS.isDueCard(w) : (typeof isDue === 'function' ? isDue(w) : true);
      if (state === 'new') newC++;
      else if (due && (state === 'learning' || state === 'relearning')) lrnC++;
      else if (due) dueC++;
    });
    return { newC, lrnC, dueC, total: wordsForDeck(deckId).length };
  }

  function getStats(deckId) {
    if (window.WordJarDeckPerformance?.computeStatsMap && window.WordJarDeckPerformance?.limitedStats) {
      const map = WordJarDeckPerformance.computeStatsMap();
      return WordJarDeckPerformance.limitedStats(deckId, map);
    }
    if (window.WordJarFSRS?.calcDeckStats) return WordJarFSRS.calcDeckStats(deckId);
    return fallbackStats(deckId);
  }

  window.showDeckOverview = function showDeckOverviewFast(deckId) {
    currentStudyDeckId = deckId;
    const isSystem = isNoDeck(deckId);
    const d = isSystem
      ? { id: NO_DECK_ID, name: NO_DECK_NAME, desc: 'System deck for cards without a user deck.', color: 'var(--ink)' }
      : realDeck(deckId);
    if (!d) return;

    const stats = getStats(deckId);
    const title = document.getElementById('ovTitle');
    const desc = document.getElementById('ovDesc');
    if (title) {
      title.textContent = d.name;
      title.style.color = d.color || 'var(--ink)';
    }
    if (desc) desc.textContent = d.desc || '';

    const ovNew = document.getElementById('ovNew');
    const ovLrn = document.getElementById('ovLrn');
    const ovRev = document.getElementById('ovRev');
    const ovTotal = document.getElementById('ovTotal');
    if (ovNew) ovNew.textContent = stats.newC || 0;
    if (ovLrn) ovLrn.textContent = stats.lrnC || 0;
    if (ovRev) ovRev.textContent = stats.dueC || 0;
    if (ovTotal) ovTotal.textContent = stats.total || 0;

    const optBtn = document.querySelector('#pg-deck-overview button[onclick^="openDeckOptionsModal"]');
    if (optBtn) optBtn.style.display = isSystem ? 'none' : 'flex';

    nav('deck-overview');
  };
})();
